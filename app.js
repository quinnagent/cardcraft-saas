// CardCraft Frontend JavaScript
// Updated: 2026-02-02 - Fixed AI generation endpoint
// API endpoint: /generate-ai-messages (not /projects/1/generate-ai-messages)

// API Configuration
const API_URL = 'https://pacific-vision-production.up.railway.app/api';

// State management
let currentState = {
    step: 1,
    template: null,
    cardsPerPage: 4,
    guests: [],
    messageType: null, // 'prewritten' or 'ai'
    tone: null,
    generatedMessages: [],
    currentPlan: null
};

// Pre-written templates
const prewrittenTemplates = {
    "Cash gift": "Time has truly flown since our beautiful wedding day. Your generous gift has been such a blessing as we've settled into married life together. We have been putting it toward creating our home, and every time we make a purchase, we think of your kindness and generosity. Thank you so much for celebrating with us and for your thoughtful gift.",
    "Gift card": "We were so happy you could join us on our special day! Your gift card was incredibly thoughtful and will help us as we build our life together. We've already started planning how to use it for our home. Thank you for your generosity and for being part of our celebration.",
    "default": "What a wonderful celebration we had, and having you there made it even more special! Your thoughtful gift means so much to us as we begin this new chapter. We're so grateful for your presence and your generosity. Thank you from the bottom of our hearts!"
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTemplateSelection();
    initUpload();
    updateProgressBar();
});

// Template Selection
function initTemplateSelection() {
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            currentState.template = card.dataset.template;
            const errorMsg = document.getElementById('templateError');
            if (errorMsg) errorMsg.style.display = 'none';
            updateProgressBar();
        });
    });
}

// Cards Per Page Selection
function selectCardsPerPage(value) {
    currentState.cardsPerPage = value;
    
    // Update UI
    document.querySelectorAll('.cards-per-page-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.style.background = '';
        opt.style.borderColor = '';
        opt.style.color = '';
    });
    
    const selected = document.querySelector(`.cards-per-page-option[data-value="${value}"]`);
    if (selected) {
        selected.classList.add('selected');
        selected.style.background = '#5c4a3d';
        selected.style.borderColor = '#5c4a3d';
        selected.style.color = 'white';
    }
    
    // Update description
    const descriptions = {
        1: 'Large cards - Perfect for detailed messages. Cards are 7" x 9"',
        2: 'Medium cards - Good balance of size and efficiency. Cards are 7.5" x 4.5"',
        4: 'Standard - Perfect for most home printers. Cards are 4.25" x 5.5"'
    };
    document.getElementById('cardsPerPageDescription').textContent = descriptions[value];
}

// Show/Hide Sections
function showSection(sectionId) {
    // Hide all sections except hero and steps
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show requested section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        // Use window.scrollTo instead of scrollIntoView for better Safari compatibility
        const rect = section.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
            window.scrollTo({
                top: window.pageYOffset + rect.top - 20,
                behavior: 'smooth'
            });
        }
    }
    
    // Show progress bar after template selection
    if (sectionId !== 'templates') {
        document.getElementById('progressBar').style.display = 'block';
    }
    
    // Update step
    updateStepFromSection(sectionId);
}

function updateStepFromSection(sectionId) {
    const stepMap = {
        'templates': 1,
        'upload': 2,
        'messageType': 3,
        'aiGeneration': 3,
        'simpleEdit': 3,
        'previewExamples': 4,
        'pricing': 5
    };
    
    if (stepMap[sectionId]) {
        currentState.step = stepMap[sectionId];
        updateProgressBar();
    }
}

function updateProgressBar() {
    document.querySelectorAll('.progress-step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        
        if (stepNum === currentState.step) {
            step.classList.add('active');
        } else if (stepNum < currentState.step) {
            step.classList.add('completed');
        }
    });
}

function startCreating() {
    showSection('templates');
    document.getElementById('progressBar').style.display = 'block';
}

function goToMessageType() {
    if (!currentState.template) {
        const errorMsg = document.getElementById('templateError');
        if (errorMsg) {
            errorMsg.style.display = 'block';
            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 3000);
        }
        return;
    }
    currentState.step = 2;
    updateProgressBar();
    showSection('messageType');
}

function goToUpload() {
    currentState.step = 3;
    updateProgressBar();
    showSection('upload');
}

function goToStep(stepNum) {
    // Define the section mapping for new flow:
    // 1: Templates, 2: Message Type, 3: Upload, 4: AI/Preview, 5: Pricing
    const stepSections = {
        1: 'templates',
        2: 'messageType',
        3: 'upload',
        4: 'previewExamples',
        5: 'pricing'
    };

    // If going to step 4 (messages/preview), check what to show
    if (stepNum === 4) {
        if (currentState.messageType === 'ai' && currentState.generatedMessages.length === 0) {
            showSection('aiGeneration');
            return;
        } else if (currentState.messageType === 'ai' && currentState.generatedMessages.length > 0) {
            showSection('simpleEdit');
            return;
        } else if (currentState.messageType === 'prewritten') {
            // For pre-written messages, validate that guests have messages
            if (currentState.guests.length === 0) {
                alert('Please upload a CSV file first.');
                showSection('upload');
                return;
            }
            
            const missingMessages = currentState.guests.filter(g => !g.message || g.message.trim() === '');
            if (missingMessages.length > 0) {
                alert(`You selected "Pre-Written Messages" but ${missingMessages.length} guest${missingMessages.length === 1 ? '' : 's'} in your CSV ${missingMessages.length === 1 ? 'is' : 'are'} missing message text.\n\nPlease either:\n• Add message text to the "Message" column in your CSV and re-upload, or\n• Go back and choose "AI-Assisted Messages" instead`);
                showSection('upload');
                return;
            }
        }
    }
    
    // If going to step 5 (pricing), validate that we have complete messages
    if (stepNum === 5) {
        if (currentState.guests.length === 0) {
            alert('Please upload a CSV file first.');
            showSection('upload');
            return;
        }
        
        if (currentState.messageType === 'prewritten') {
            const missingMessages = currentState.guests.filter(g => !g.message || g.message.trim() === '');
            if (missingMessages.length > 0) {
                alert(`You selected "Pre-Written Messages" but ${missingMessages.length} guest${missingMessages.length === 1 ? '' : 's'} in your CSV ${missingMessages.length === 1 ? 'is' : 'are'} missing message text.\n\nPlease either:\n• Add message text to the "Message" column in your CSV and re-upload, or\n• Go back and choose "AI-Assisted Messages" instead`);
                showSection('upload');
                return;
            }
        } else if (currentState.messageType === 'ai' && currentState.generatedMessages.length === 0) {
            alert('Please generate AI messages first.');
            showSection('aiGeneration');
            return;
        }
    }

    currentState.step = stepNum;
    updateProgressBar();
    showSection(stepSections[stepNum]);
}

function goHome() {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Hide progress bar
    document.getElementById('progressBar').style.display = 'none';
    
    // Reset step
    currentState.step = 1;
    updateProgressBar();
    
    // Scroll to hero
    document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
}

function scrollToSection(sectionId) {
    // First go home to show landing page sections
    goHome();
    
    // Then scroll to the specific section
    setTimeout(() => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

// File Upload
function initUpload() {
    const uploadBox = document.getElementById('uploadBox');
    const fileInput = document.getElementById('fileInput');

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
}

async function handleFile(file) {
    const uploadBox = document.getElementById('uploadBox');
    
    // Check file type
    if (!file.name.endsWith('.csv')) {
        uploadBox.innerHTML = `
            <div class="upload-icon" style="color: #c44;">✗</div>
            <h3 style="color: #c44;">Invalid file type</h3>
            <p>Please upload a CSV file (.csv)</p>
            <button class="btn" style="margin-top: 1rem;" onclick="document.getElementById('fileInput').click()">Try Again</button>
        `;
        return;
    }
    
    uploadBox.innerHTML = `
        <div class="upload-icon">⏳</div>
        <h3>Processing...</h3>
        <p>${file.name}</p>
    `;
    
    try {
        // Parse CSV and get actual guest count
        const { guests, rowCount, errors } = await parseCSV(file);
        
        if (errors.length > 0) {
            throw new Error(errors[0]);
        }
        
        if (guests.length === 0) {
            throw new Error('No valid guests found in CSV');
        }
        
        uploadBox.innerHTML = `
            <div class="upload-icon">✓</div>
            <h3>File uploaded successfully!</h3>
            <p>${file.name}</p>
            <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">Found ${guests.length} guest${guests.length === 1 ? '' : 's'}...</p>
        `;
        
        // Store actual guests from CSV
        currentState.guests = guests;
        
        // Route based on message type choice
        setTimeout(() => {
            if (currentState.messageType === 'prewritten') {
                // Check if all guests have messages
                const hasAllMessages = generatePrewrittenMessages();
                if (hasAllMessages) {
                    showPreviewExamples();
                }
                // If hasAllMessages is false, error is shown and we stay on upload page
            } else {
                showSection('aiGeneration');
            }
        }, 1000);
        
    } catch (error) {
        uploadBox.innerHTML = `
            <div class="upload-icon" style="color: #c44;">✗</div>
            <h3 style="color: #c44;">Upload failed</h3>
            <p>${error.message}</p>
            <div style="background: #fee; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: left; font-size: 0.9rem;">
                <strong>Make sure your CSV has:</strong>
                <ul style="margin: 0.5rem 0 0 1.5rem;">
                    <li>Column headers: Name, Gift, Message (optional)</li>
                    <li>One guest per row</li>
                    <li>No empty rows</li>
                </ul>
            </div>
            <button class="btn" style="margin-top: 1rem;" onclick="document.getElementById('fileInput').click()">Try Again</button>
        `;
    }
}

function parseCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                resolve({ guests: [], rowCount: 0, errors: ['CSV file is empty or has no data rows'] });
                return;
            }
            
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const nameIndex = headers.indexOf('name');
            const giftIndex = headers.indexOf('gift');
            const messageIndex = headers.indexOf('message');
            
            if (nameIndex === -1 || giftIndex === -1) {
                resolve({ guests: [], rowCount: 0, errors: ['CSV must have "Name" and "Gift" columns'] });
                return;
            }
            
            const guests = [];
            const errors = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Simple CSV parsing (handles basic quoted fields)
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                
                const name = values[nameIndex];
                const gift = values[giftIndex];
                const message = messageIndex !== -1 ? values[messageIndex] : '';
                
                if (name && gift) {
                    guests.push({ name, gift, message });
                }
            }
            
            resolve({ guests, rowCount: lines.length - 1, errors });
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsText(file);
    });
}

// Message Type Selection
function selectMessageType(type, element) {
    currentState.messageType = type;
    
    document.querySelectorAll('.message-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    if (element) {
        element.classList.add('selected');
    }
    
    setTimeout(() => {
        // Both paths now go to upload first, then handle messages
        goToUpload();
    }, 300);
}

function generatePrewrittenMessages() {
    // Check if all guests have messages in the CSV
    const missingMessages = currentState.guests.filter(g => !g.message || g.message.trim() === '');
    
    if (missingMessages.length > 0) {
        // Show error and don't proceed
        const uploadBox = document.getElementById('uploadBox');
        uploadBox.innerHTML = `
            <div class="upload-icon" style="color: #c44;">✗</div>
            <h3 style="color: #c44;">Missing Messages</h3>
            <p>You selected "Pre-Written Messages" but ${missingMessages.length} guest${missingMessages.length === 1 ? '' : 's'} in your CSV ${missingMessages.length === 1 ? 'is' : 'are'} missing message text.</p>
            <div style="background: #fee; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: left; font-size: 0.9rem;">
                <strong>Options:</strong>
                <ul style="margin: 0.5rem 0 0 1.5rem;">
                    <li>Add message text to the "Message" column in your CSV</li>
                    <li>Or go back and choose "AI-Assisted Messages" instead</li>
                </ul>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
                <button class="btn btn-back" onclick="goToStep(2)">← Back to Message Type</button>
                <button class="btn" onclick="document.getElementById('fileInput').click()">Upload Different CSV</button>
            </div>
        `;
        return false;
    }
    
    // All guests have messages - proceed
    return true;
}

// AI Generation
function selectTone(tone, element) {
    currentState.tone = tone;
    
    document.querySelectorAll('.tone-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    if (element) {
        element.classList.add('selected');
    }
    
    document.getElementById('generateBtn').disabled = false;
}

async function generateAIMessages() {
    if (!currentState.tone) return;
    
    const loadingDiv = document.getElementById('aiLoading');
    const generateBtn = document.getElementById('generateBtn');
    
    loadingDiv.classList.add('active');
    generateBtn.disabled = true;
    
    try {
        // Prepare request body
        const requestBody = {
            tone: currentState.tone,
            guests: currentState.guests.map((g, i) => ({
                id: i,
                name: g.name,
                gift: g.gift
            }))
        };
        
        console.log('Sending request to:', `${API_URL}/generate-ai-messages`);
        console.log('Request body:', JSON.stringify(requestBody));
        
        // Call backend API to generate AI messages (no auth required)
        let response;
        try {
            response = await fetch(`${API_URL}/generate-ai-messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        } catch (networkError) {
            console.error('Network error during fetch:', networkError);
            throw new Error('Network error: ' + networkError.message);
        }
        
        console.log('Response received, status:', response.status);
        
        if (!response.ok) {
            let errorMessage = 'Failed to generate AI messages';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = 'Server error: ' + response.status;
            }
            throw new Error(errorMessage);
        }
        
        // Get response as text first for debugging
        let responseText;
        try {
            responseText = await response.text();
            console.log('Response text:', responseText.substring(0, 200));
        } catch (textError) {
            console.error('Error reading response text:', textError);
            throw new Error('Failed to read server response');
        }
        
        // Parse JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text was:', responseText);
            throw new Error('Invalid response from server');
        }
        
        console.log('Parsed response data:', data);
        
        if (!data.success || !data.cards || !Array.isArray(data.cards)) {
            throw new Error('Invalid response format from server');
        }
        
        // Update guests with AI-generated messages
        currentState.generatedMessages = data.cards;
        currentState.guests = data.cards.map(card => ({
            name: card.recipient_name || card.name,
            gift: card.gift,
            message: card.message
        }));
        
        console.log('Updated guests:', currentState.guests);
        
        // Populate edit list
        try {
            populateEditList();
        } catch (e) {
            console.error('Error in populateEditList:', e);
            throw new Error('Failed to populate edit list: ' + e.message);
        }
        
        // Go to simple edit view
        try {
            showSection('simpleEdit');
        } catch (e) {
            console.error('Error in showSection:', e);
            throw new Error('Failed to show edit section: ' + e.message);
        }
        
    } catch (error) {
        console.error('Full error object:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        alert('Error: ' + (error.message || error.toString()) + '\n\nPlease try again or write your own messages.');
    } finally {
        loadingDiv.classList.remove('active');
        generateBtn.disabled = false;
    }
}

// Simple Edit List
function populateEditList() {
    const container = document.getElementById('editListContainer');
    
    // Escape HTML special characters to prevent breaking the template
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Build HTML using createElement to avoid innerHTML issues in Safari
    container.innerHTML = '';
    
    currentState.guests.forEach((guest, index) => {
        const item = document.createElement('div');
        item.className = 'edit-list-item';
        
        const header = document.createElement('div');
        header.className = 'edit-list-header';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'edit-list-recipient';
        nameSpan.textContent = guest.name;
        
        const giftSpan = document.createElement('span');
        giftSpan.className = 'edit-list-gift';
        giftSpan.textContent = guest.gift;
        
        header.appendChild(nameSpan);
        header.appendChild(giftSpan);
        
        const textarea = document.createElement('textarea');
        textarea.className = 'edit-list-textarea';
        textarea.id = 'edit-' + index;
        textarea.textContent = guest.message;
        textarea.onchange = function() { updateMessage(index, this.value); };
        
        item.appendChild(header);
        item.appendChild(textarea);
        
        container.appendChild(item);
    });
}

function updateMessage(index, newMessage) {
    currentState.guests[index].message = newMessage;
}

// Preview Examples - Show actual card visuals
function showPreviewExamples() {
    const grid = document.getElementById('previewExamplesGrid');
    const totalCount = document.getElementById('totalCardCount');
    
    // Show first 4 guests as examples
    const examples = currentState.guests.slice(0, 4);
    const template = currentState.template || 'classic';
    
    grid.innerHTML = examples.map((guest, index) => {
        // Get first name for signature
        const firstNames = "Collin and Annika";
        
        return `
        <div class="preview-example-card">
            <div class="preview-card-visual ${template}">
                <div class="preview-card-header">Thank You</div>
                <div class="preview-card-recipient">Dear ${guest.name},</div>
                <div class="preview-card-message">${guest.message}</div>
                <div class="preview-card-signature">${firstNames}</div>
            </div>
            <div class="preview-card-info">
                <h4>${guest.name}</h4>
                <div class="gift-tag">${guest.gift}</div>
            </div>
        </div>
    `}).join('');
    
    totalCount.textContent = currentState.guests.length;
    
    currentState.step = 4;
    updateProgressBar();
    showSection('previewExamples');
}

// Payment
function openPayment(plan) {
    currentState.currentPlan = plan;
    const prices = { starter: 19, premium: 39, unlimited: 79 };
    const price = prices[plan];
    
    // Update payment button amount
    document.getElementById('payAmount').textContent = price;
    
    // Update order summary
    const templateNames = {
        classic: 'Classic Elegance',
        modern: 'Modern Minimal',
        romantic: 'Romantic Blush'
    };
    
    const planNames = {
        starter: 'Starter (up to 25 cards)',
        premium: 'Premium (up to 75 cards)',
        unlimited: 'Unlimited'
    };
    
    document.getElementById('orderTemplate').textContent = templateNames[currentState.template] || 'Classic Elegance';
    document.getElementById('orderCardCount').textContent = currentState.guests.length + ' cards';
    document.getElementById('orderPlan').textContent = planNames[plan] || 'Premium';
    document.getElementById('orderTotal').textContent = price;
    
    document.getElementById('paymentModal').classList.add('active');
    
    // Initialize Stripe elements
    initStripe();
}

function closePayment() {
    document.getElementById('paymentModal').classList.remove('active');
}

function closePaymentModal() {
    closePayment();
}

// Initialize Stripe
const stripe = Stripe('pk_live_51SvqbT2Oew1Lm9HTRyzIMLCabQLvxAyCEE5Pl4j1xGuxAqzx3CMNMzsbNgpEx3dNgZztdJHGd9Tg1SOWQaQgBYeK00PygXjyxH');
let cardElement;

// Initialize card element when payment modal opens
function initStripe() {
    if (!cardElement) {
        try {
            const elements = stripe.elements();
            cardElement = elements.create('card', {
                style: {
                    base: {
                        fontSize: '16px',
                        color: '#3d3d3d',
                        '::placeholder': { color: '#aab7c4' }
                    }
                }
            });
            
            // Mount to the card element container
            const cardContainer = document.getElementById('cardElement');
            if (cardContainer) {
                cardElement.mount('#cardElement');
                console.log('Stripe card element mounted successfully');
            } else {
                console.error('Card element container not found');
            }
            
            cardElement.on('change', (event) => {
                const errorDiv = document.getElementById('cardErrors');
                if (errorDiv) {
                    errorDiv.textContent = event.error ? event.error.message : '';
                }
            });
        } catch (error) {
            console.error('Error initializing Stripe:', error);
        }
    }
}

// Payment form submission
document.getElementById('paymentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('payButton');
    const originalText = btn.textContent;
    btn.textContent = 'Processing...';
    btn.disabled = true;
    
    const email = document.getElementById('emailInput').value;
    
    try {
        // Simple payment flow - no registration needed
        // 1. Create payment intent (guest checkout)
        console.log('Creating payment intent...', API_URL);
        
        let paymentRes;
        try {
            paymentRes = await fetch(`${API_URL}/create-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: currentState.currentPlan || 'premium',
                    email: email,
                    guests: currentState.guests || [],
                    template: currentState.template || 'classic'
                })
            });
        } catch (networkError) {
            console.error('Network error:', networkError);
            throw new Error('Cannot connect to payment server. Please check your internet connection and try again.');
        }
        
        console.log('Payment intent response:', paymentRes.status);
        
        if (!paymentRes.ok) {
            let errorMessage = 'Payment setup failed';
            try {
                const error = await paymentRes.json();
                errorMessage = error.error || error.message || 'Payment setup failed';
            } catch (e) {
                errorMessage = `Server error (${paymentRes.status}). Please try again.`;
            }
            throw new Error(errorMessage);
        }
        
        const { clientSecret } = await paymentRes.json();
        
        // 2. Confirm payment with Stripe
        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: { email }
            }
        });
        
        if (error) throw new Error(error.message);
        
        // 3. Confirm on backend (this triggers email with download link)
        await fetch(`${API_URL}/confirm-payment-simple`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                email: email
            })
        });
        
        alert('Payment successful! Check your email for the download link.');
        closePayment();
        
    } catch (err) {
        document.getElementById('cardErrors').textContent = err.message;
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// Initialize stripe when payment modal opens
const originalOpenPayment = openPayment;
openPayment = function(plan) {
    currentState.currentPlan = plan;
    const prices = { starter: 19, premium: 39, unlimited: 79 };
    document.getElementById('payAmount').textContent = prices[plan];
    document.getElementById('paymentModal').classList.add('active');
    initStripe();
};

// Close modal on outside click
document.getElementById('paymentModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'paymentModal') closePayment();
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// API Integration functions (for when backend is ready)
async function createProject(template) {
    // Call backend API
    console.log('Creating project with template:', template);
}

async function uploadCSV(projectId, file) {
    // Call backend API
    console.log('Uploading CSV for project:', projectId);
}

async function saveProject() {
    // Save current state to backend
    console.log('Saving project:', currentState);
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { currentState, generateAIMessage };
}
