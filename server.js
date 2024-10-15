const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const pdfParse = require('pdf-parse');
require('dotenv').config({ path: '.encrypted.env' });

const app = express();
const PORT = process.env.PORT || 3000;

const sslOptions = {
    key: fs.readFileSync('localhost-key.pem'),
    cert: fs.readFileSync('localhost.pem')
};

app.use(helmet());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.KEY, 'hex');
const iv = Buffer.from(process.env.IV, 'hex');

function decrypt(encryptedText) {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const OPENAI_API_KEY = decrypt(process.env.ENCRYPTED_API_KEY);

const customAnswers = {
    "What is your name?": { response: "My name is Skyler, and I would love to assist you today!" },
    "Can you help me with job search?": { response: "Absolutely! I can assist you in finding job opportunities that match your profile." },
    "What jobs are available?": { response: "There are many job openings available. Please provide more details on the type of job you're looking for." },
    "How can I find a job?": { response: "I can help you find the perfect job that suits your skills and interests!" },
    "איך אני מוצא עבודה?": { response: "אני יכולה לעזור לך למצוא את העבודה המתאימה ביותר לכישורים ולתחומי העניין שלך!" },
    "איזה שירותים את מציעה?": { response: "אני יכולה לעזור לך בחיפוש עבודה, ייעוץ קריירה, ומענה על כל שאלה שיש לך." },
    "מה שמך?": { response: "שמי סקיילר ואני אשמח לעזור לך היום!" },
    "מה השם שלך?": { response: "שמי סקיילר ואני אשמח לעזור לך היום!" },
    "איך את יכולה לעזור לי?": { response: "אני יכולה לעזור לך למצוא משרה שמתאימה לך!" },
    "איך את יכולה לעזור לי היום?": { response: "אני יכולה לעזור לך למצוא משרה שמתאימה לך" },
    "עבודות לגילאים 18-25": { response: "אנחנו מציעים עבודות רלוונטיות לגילאים מהתחומים הבאים: שירות לקוחות, מכירות, הדרכה וצלילה מקצועית" },
    "משרות עם שכר 45+": { response: "העבודות רלוונטיות לשכר הזה יכולים להיות מהתחומים: פיננסים, ביטוח, אבטחה ועוד" },
    "עבודות לחיילים משוחררים": { response: "מגוון עבודות שיכולות להתאים בתחום האבטחה או שמירה" },
    "איזה משרות זמינות?": { response: "האתר שלנו מציע מגוון רחב של משרות שמתאימות לך, בין היתר משרות בתחומים: נהגים, ביטוח, שירות לקוחות, מכירות, סלולר, אופנה, תקשורת, הדרכה, פיננסים, משאבי אנוש, אבטחה ועוד" },
    "bye": { response: "Goodbye! Have a great day!", closeChat: true },
    "ביי": { response: "להתראות! שיהיה לך יום נפלא!", closeChat: true }
};

const upload = multer({ dest: 'uploads/' });

app.post('/upload-cv', upload.single('cv'), async (req, res) => {
    const cvPath = req.file.path;
    const fileType = req.file.mimetype;

    let cvText = '';

    try {
        if (fileType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(cvPath);
            const data = await pdfParse(dataBuffer);
            cvText = data.text;
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const buffer = fs.readFileSync(cvPath);
            const doc = new Document(buffer);
            cvText = doc.getText();
        } else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }

        const analysisResults = await getCVAnalysis(cvText);

        // Delete the file after processing
        fs.unlinkSync(cvPath);

        res.json({ response: analysisResults });
    } catch (error) {
        console.error('Error processing CV:', error);
        fs.unlinkSync(cvPath);
        res.status(500).json({ error: 'Failed to process CV' });
    }
});

async function getCVAnalysis(cvText) {
    const maxRetries = 3;
    let attempt = 0;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    while (attempt < maxRetries) {
        try {
            const summarizedCV = summarizeCV(cvText);
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that provides CV analysis and suggestions in Hebrew.' },
                    { role: 'user', content: `הנה קורות חיים מסוכמים:\n\n${summarizedCV}\n\nאנא ספק הצעות מפורטות לשיפור.` }
                ],
                max_tokens: 1000, // Increased max tokens to allow for longer responses
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response data:', response.data);
            const analysisText = response.data.choices[0].message.content.trim();
            return formatSuggestions(analysisText);

        } catch (error) {
            console.error('Error analyzing CV:', error.response ? error.response.data : error.message);
            if (error.response && error.response.status >= 500) {
                attempt++;
                await delay(1000); 
                continue;
            }
            throw new Error('Failed to analyze CV');
        }
    }

    throw new Error('Failed to analyze CV after multiple attempts');
}

function summarizeCV(cvText) {
    const sections = cvText.split('\n\n');
    const maxSectionLength = 1000; 
    return sections.map(section => section.slice(0, maxSectionLength)).join('\n\n');
}

function formatSuggestions(suggestionsText) {
    const intro = "<strong>הנה כמה הצעות לשיפור קורות החיים שלך:</strong>";
    const suggestions = suggestionsText.split(/\d+\.\s/).filter(Boolean);
    const formattedSuggestions = suggestions.map((suggestion, index) => `${index + 1}. ${suggestion.trim()}`).join('<br>');
    return `${intro}<br><br>${formattedSuggestions}`; // Added an extra <br> for spacing
}

app.post('/chat', async (req, res) => {
    const userInput = req.body.input;
    const chatHistory = req.body.chatHistory || [];

    if (customAnswers[userInput]) {
        return res.json(customAnswers[userInput]);
    }

    try {
        console.log('Chat started successfully');

        const messages = chatHistory.map(([role, content]) => ({ role, content }));
        messages.push({ role: 'user', content: userInput });

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 500, // Increased max tokens to handle longer responses
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const completionText = response.data.choices[0].message.content.trim();
        console.log('Bot responded successfully');

        res.json({ response: completionText });
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch response from ChatGPT' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});
