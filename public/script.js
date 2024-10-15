if (!window.chatScriptLoaded) {
    window.chatScriptLoaded = true;

    const chatButton = document.getElementById('chat-button');
    const chatWindow = document.getElementById('chat-window');
    const minimizeButton = document.getElementById('minimize-button');
    const sendButton = document.getElementById('send-button');
    const chatInput = document.getElementById('chat-input');
    const typingIndicator = document.getElementById('typing-indicator');
    const messagesDiv = document.getElementById('messages');
    const suggestions = document.querySelectorAll('.suggestion');
    const chatStartTimeDiv = document.getElementById('chat-start-time');

    let chatStarted = false;
    const customAnswer = "נהדר! אני כאן כדי לעזור לך לשפר את קורות החיים שלך. אנא העלה את קובץ קורות החיים שלך כדי שנוכל להתחיל.";

    chatButton.addEventListener('click', function() {
        toggleChatWindow();
    });

    minimizeButton.addEventListener('click', function() {
        chatWindow.classList.toggle('minimized');
        if (chatWindow.classList.contains('minimized')) {
            minimizeButton.style.top = '0px';
            minimizeButton.style.transition = 'top 3s ease, opacity 3s ease';
            minimizeButton.style.opacity = '1';
        } else {
            minimizeButton.style.top = '0px';
            minimizeButton.style.transition = 'top 3s ease, opacity 3s ease';
            minimizeButton.style.opacity = '0';
            setTimeout(() => {
                minimizeButton.style.transition = 'none';
                minimizeButton.style.top = '30px';
                setTimeout(() => {
                    minimizeButton.style.transition = 'top 5s ease, opacity 5s ease';
                    minimizeButton.style.top = '60px';
                    minimizeButton.style.opacity = '1';
                }, 3000);
            }, 300);
        }
    });

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    suggestions.forEach(button => {
        button.addEventListener('click', () => {
            chatInput.value = button.textContent;
            button.classList.add('hidden');
            sendMessage();
        });
    });

    let chatHistory = [];

    async function sendMessage() {
        const userInput = chatInput.value.trim();
        if (!userInput) return;

        if (!chatStarted) {
            setChatStartTime();
            chatStarted = true;
        }

        const timestamp = new Date().toISOString();
        addMessage('user', userInput);

        chatInput.value = '';
        typingIndicator.classList.add('visible');

        if (userInput.includes("שיפור קורות חיים שלי")) {
            displayTypingEffect(customAnswer, timestamp, () => {
                setTimeout(() => {
                    displayCVUploadOption();
                    typingIndicator.classList.remove('visible');
                    scrollToBottom();
                }, 1000); 
            });
            return;
        }

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ input: userInput, chatHistory: chatHistory })
            });

            const data = await response.json();
            if (data.response) {
                displayTypingEffect(data.response, timestamp);
                chatHistory.push(['user', userInput]);
                chatHistory.push(['assistant', data.response]);

                if (data.closeChat) {
                    setTimeout(closeChatWindow, 3000);
                }
            }
        } catch (error) {
            console.error('Error fetching response:', error);
        }

        typingIndicator.classList.remove('visible');
    }

    function displayTypingEffect(text, timestamp, callback) {
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.classList.add('message', 'assistant');
        assistantMessageDiv.setAttribute('data-timestamp', timestamp);

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');

        const messageLabel = document.createElement('div');
        messageLabel.classList.add('message-label', 'static-text');
        messageLabel.textContent = 'סקיילר:';

        const messageText = document.createElement('span');
        messageText.classList.add('message-text');
        messageText.setAttribute("dir", "auto");

        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = ' (הרגע)';

        messageBubble.appendChild(messageLabel);
        messageBubble.appendChild(messageText);
        messageBubble.appendChild(timestampSpan);
        assistantMessageDiv.appendChild(messageBubble);
        messagesDiv.appendChild(assistantMessageDiv);

        let index = 0;
        const words = text.split(' ');

        function typeNextWord() {
            if (index < words.length) {
                messageText.textContent += words[index] + ' ';
                index++;
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                setTimeout(typeNextWord, 50); 
            } else {
                messageText.innerHTML = text.replace(/<br>/g, '<br>'); 
                if (callback) callback();
            }
        }

        typeNextWord();
    }

    function addMessage(role, text) {
        const timestamp = new Date().toISOString();
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        messageDiv.setAttribute('data-timestamp', timestamp);

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');

        const messageLabel = document.createElement('div');
        messageLabel.classList.add('message-label', 'static-text');
        messageLabel.textContent = role === 'user' ? 'אתה:' : 'סקיילר:';

        const messageText = document.createElement('span');
        messageText.classList.add('message-text');
        messageText.innerHTML = text.replace(/<br>/g, '<br>'); 

        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = ' (הרגע)';

        messageBubble.appendChild(messageLabel);
        messageBubble.appendChild(messageText);
        messageBubble.appendChild(timestampSpan);
        messageDiv.appendChild(messageBubble);
        messagesDiv.appendChild(messageDiv);
        scrollToBottom();
    }

    function displayCVUploadOption() {
        const cvUploadContainer = document.createElement('div');
        cvUploadContainer.id = 'cv-upload-container';
        cvUploadContainer.classList.remove('error');
        cvUploadContainer.innerHTML = `
            <p>עלה קורות חיים שלך לשיפור</p>
            <div id="cv-file-name" class="hidden">
                <span id="cv-file-name-text"></span>
                <span class="remove-cv hidden">x</span>
            </div>
            <div id="cv-upload-row">
                <input type="file" id="cv-upload-input" accept=".pdf,.doc,.docx" aria-label="Upload your CV" class="hidden">
                <label for="cv-upload-input" class="cv-upload-label">
                    <img src="/images/file+icon.png" alt="Upload Icon" class="upload-icon">
                </label>
                <button id="cv-upload-button" aria-label="Upload CV for Analysis"><i class="fas fa-arrow-up"></i></button>
            </div>
        `;
        messagesDiv.appendChild(cvUploadContainer);
        scrollToBottom(); 

        const cvUploadButton = document.getElementById('cv-upload-button');
        const cvUploadInput = document.getElementById('cv-upload-input');
        const cvFileName = document.getElementById('cv-file-name');
        const cvFileNameText = document.getElementById('cv-file-name-text');
        const removeCVButton = document.querySelector('.remove-cv');

        cvUploadInput.addEventListener('change', () => {
            if (cvUploadInput.files.length > 0) {
                cvFileNameText.textContent = cvUploadInput.files[0].name;
                cvFileName.classList.remove('hidden');
                removeCVButton.classList.remove('hidden');
                cvUploadContainer.classList.remove('error'); 
            } else {
                cvFileName.classList.add('hidden');
                removeCVButton.classList.add('hidden');
            }
        });

        removeCVButton.addEventListener('click', () => {
            cvUploadInput.value = null;
            cvFileNameText.textContent = '';
            cvFileName.classList.add('hidden');
            removeCVButton.classList.add('hidden');
        });

        cvUploadButton.addEventListener('click', () => {
            uploadCV(cvUploadInput, cvUploadContainer);
        });
    }

    async function uploadCV(cvUploadInput, cvUploadContainer) {
        const file = cvUploadInput.files[0];

        if (!file) {
            alertCentered('עלה קורות החיים שלך בבקשה');
            cvUploadContainer.classList.add('error'); 
            return;
        }
        
        function alertCentered(message) {
            let alertDiv = document.createElement('div');
            alertDiv.textContent = message;
            alertDiv.style.position = 'fixed';
            alertDiv.style.top = '50%';
            alertDiv.style.left = '50%';
            alertDiv.style.transform = 'translate(-50%, -50%)';
            alertDiv.style.backgroundColor = 'white';
            alertDiv.style.padding = '20px';
            alertDiv.style.border = '1px solid #ccc';
            alertDiv.style.borderRadius = '5px';
            alertDiv.style.zIndex = '9999';
            alertDiv.style.textAlign = 'center';
            alertDiv.style.borderRadius = '10px';

        
            document.body.appendChild(alertDiv);
        
            setTimeout(function() {
                document.body.removeChild(alertDiv);
            }, 4000);  
        }

        const formData = new FormData();
        formData.append('cv', file);

        typingIndicator.classList.add('visible');

        try {
            const response = await fetch('/upload-cv', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.response) {
                addMessage('assistant', data.response);
                typingIndicator.classList.remove('visible');
                document.getElementById('cv-upload-container').remove();
                scrollToBottom(); 
            }
        } catch (error) {
            console.error('Error uploading CV:', error);
            typingIndicator.classList.remove('visible');
        }
    }

    function scrollToBottom() {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function showSuggestionsWithAnimation() {
        suggestions.forEach(button => {
            button.classList.remove('show');
        });

        suggestions.forEach((button, index) => {
            setTimeout(() => {
                button.classList.add('show');
            }, index * 100);
        });
    }

    showSuggestionsWithAnimation();

    function updateTimestamps() {
        const now = new Date();
        const messageElements = document.querySelectorAll('#messages div[data-timestamp]');
        messageElements.forEach(message => {
            const timestamp = new Date(message.getAttribute('data-timestamp'));
            const secondsAgo = Math.floor((now - timestamp) / 1000);
            let timeAgoText = '';

            if (secondsAgo < 60) {
                timeAgoText = 'הרגע';
            } else if (secondsAgo < 3600) {
                const minutesAgo = Math.floor(secondsAgo / 60);
                timeAgoText = `${minutesAgo} ${minutesAgo > 1 ? 'דקות' : 'דקה'} לפני`;
            } else if (secondsAgo < 86400) {
                const hoursAgo = Math.floor(secondsAgo / 3600);
                timeAgoText = `${hoursAgo} ${hoursAgo > 1 ? 'שעות' : 'שעה'} לפני`;
            } else {
                const daysAgo = Math.floor(secondsAgo / 86400);
                timeAgoText = `${daysAgo} ${daysAgo > 1 ? 'ימים' : 'יום'} לפני`;
            }

            const timestampElement = message.querySelector('.timestamp');
            if (timestampElement) {
                timestampElement.textContent = ` (${timeAgoText})`;
            }
        });
    }

    setInterval(updateTimestamps, 60000);

    function setChatStartTime() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const formattedDate = now.toLocaleDateString('he-IL', options);
        chatStartTimeDiv.textContent = `שיחה התחילה ב ${formattedDate}`;
    }

    function animatePlaceholder() {
        const placeholderText = "איזה משרה אתם מחפשים?";
        let currentIndex = 0;

        function typeNextCharacter() {
            if (currentIndex < placeholderText.length) {
                chatInput.placeholder += placeholderText[currentIndex];
                currentIndex++;
                setTimeout(typeNextCharacter, 100); 
            }
        }

        chatInput.placeholder = ""; 
        typeNextCharacter();
    }

    function toggleChatWindow() {
        if (!chatButton.classList.contains('expanded')) {
            chatButton.classList.add('expanded');
            chatWindow.style.bottom = '90px';
            chatWindow.style.transform = 'translateY(100%)';
            chatWindow.style.opacity = '0';
            chatWindow.style.display = 'flex';
            setTimeout(() => {
                chatWindow.style.transform = 'translateY(0)';
                chatWindow.style.opacity = '1';
                showSuggestionsWithAnimation();
                animatePlaceholder();
            }, 50);

            minimizeButton.style.opacity = '0';
            minimizeButton.style.top = '20px';
            minimizeButton.style.transition = 'none';
            setTimeout(() => {
                minimizeButton.style.transition = 'top 3s ease, opacity 3s ease';
                minimizeButton.style.top = '70px';
                minimizeButton.style.opacity = '1';
            }, 3000);

            setTimeout(() => {
                sendButton.classList.remove('pulse');
                sendButton.classList.add('color-change');
            }, 5000);
        } else {
            chatButton.classList.remove('expanded');
            chatWindow.style.transform = 'translateY(100%)';
            chatWindow.style.opacity = '0';
            setTimeout(() => {
                chatWindow.style.display = 'none';
            }, 300);
        }
    }

    function closeChatWindow() {
        chatButton.classList.remove('expanded');
        chatWindow.style.transform = 'translateY(100%)';
        chatWindow.style.opacity = '0';
        setTimeout(() => {
            chatWindow.style.display = 'none';
        }, 300);
    }
}
