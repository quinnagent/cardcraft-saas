// CardCraft Frontend JavaScript

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

// Sample guest data for demo
const sampleGuests = [
    { name: "Michael Johnson", gift: "Cash gift - $200", message: "" },
    { name: "Janet and Stacey Miller", gift: "Target gift card - $50", message: "" },
    { name: "Mr. and Mrs. Robert Smith", gift: "KitchenAid Stand Mixer", message: "" },
    { name: "Emily and David Chen", gift: "Wine glasses set", message: "" },
    { name: "Aunt Susan", gift: "Cash gift - $500", message: "" },
    { name: "The Thompson Family", gift: "Instant Pot", message: "" },
    { name: "Cousin Jake", gift: "Amazon gift card - $100", message: "" },
    { name: "Grandma Betty", gift: "Handmade quilt", message: "" }
];

// Pre-written templates
const prewrittenTemplates = {
    "Cash gift": "Time has truly flown since our beautiful wedding day. Your generous gift has been such a blessing as we've settled into married life together. We have been putting it toward creating our home, and every time we make a purchase, we think of your kindness and generosity. Thank you so much for celebrating with us and for your thoughtful gift.",
    "Gift card": "We were so happy you could join us on our special day! Your gift card was incredibly thoughtful and will help us as we build our life together. We've already started planning how to use it for our home. Thank you for your generosity and for being part of our celebration.",
    "default": "What a wonderful celebration we had, and having you there made it even more special! Your thoughtful gift means so much to us as we begin this new chapter. We're so grateful for your presence and your generosity. Thank you from the bottom of our hearts!"
};

// AI message generator (mock - replace with actual API call)
async function generateAIMessage(guest, tone) {
    // In production, this would call your backend API which uses OpenAI/Anthropic
    // For demo, return mock messages based on tone
    const toneMessages = {
        warm: `Dear ${guest.name},\n\nWe can't thank you enough for being part of our special day and for your incredibly thoughtful ${guest.gift.toLowerCase()}. It means the world to us that you took the time to celebrate with us, and your generosity has touched our hearts deeply. We're so grateful to have you in our lives!\n\nWith love and appreciation,\nCollin and Annika`,
        
        formal: `Dear ${guest.name},\n\nWe wish to express our sincere gratitude for your presence at our wedding and for your generous gift of ${guest.gift.toLowerCase()}. Your thoughtfulness is deeply appreciated as we begin our married life together. We are honored to have shared this special occasion with you.\n\nWith warm regards,\nCollin and Annika`,
        
        casual: `Hey ${guest.name.split(' ')[0]}!\n\nThanks so much for coming to our wedding and for the awesome ${guest.gift.toLowerCase()}! We had such a blast celebrating with you. Your gift is going to be so useful as we set up our new place together. Really appreciate you being there!\n\nThanks again,\nCollin and Annika`,
        
        poetic: `Dearest ${guest.name},\n\nLike stars that light the evening sky,\nYour presence made our wedding shine.\nYour gift of ${guest.gift.toLowerCase()}, so thoughtful and kind,\nFills our hearts with joy divine.\n\nThank you for sharing in our love's sweet story,\nAnd for being part of our forever.\n\nWith eternal gratitude,\nCollin and Annika`
    };
    
    return toneMessages[tone] || toneMessages.warm;
}

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
        section.scrollIntoView({ behavior: 'smooth' });
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
        }
        // Pre-written goes to preview
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

function handleFile(file) {
    const uploadBox = document.getElementById('uploadBox');
    uploadBox.innerHTML = `
        <div class="upload-icon">✓</div>
        <h3>File uploaded successfully!</h3>
        <p>${file.name}</p>
        <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">Processing ${sampleGuests.length} guests...</p>
    `;
    
    // Simulate processing delay
    setTimeout(() => {
        currentState.guests = [...sampleGuests];
        
        // Route based on message type choice
        if (currentState.messageType === 'prewritten') {
            generatePrewrittenMessages();
            currentState.step = 4;
            updateProgressBar();
            showSection('previewExamples');
        } else {
            currentState.step = 4;
            updateProgressBar();
            showSection('aiGeneration');
        }
    }, 1500);
}

// Message Type Selection
function selectMessageType(type) {
    currentState.messageType = type;
    
    document.querySelectorAll('.message-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    setTimeout(() => {
        // Both paths now go to upload first, then handle messages
        goToUpload();
    }, 300);
}

function generatePrewrittenMessages() {
    currentState.guests = currentState.guests.map(guest => {
        const giftType = guest.gift.toLowerCase().includes('cash') ? 'Cash gift' :
                        guest.gift.toLowerCase().includes('card') ? 'Gift card' : 'default';
        return {
            ...guest,
            message: prewrittenTemplates[giftType] || prewrittenTemplates.default
        };
    });
}

// AI Generation
function selectTone(tone) {
    currentState.tone = tone;
    
    document.querySelectorAll('.tone-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    document.getElementById('generateBtn').disabled = false;
}

async function generateAIMessages() {
    if (!currentState.tone) return;
    
    const loadingDiv = document.getElementById('aiLoading');
    const generateBtn = document.getElementById('generateBtn');
    
    loadingDiv.classList.add('active');
    generateBtn.disabled = true;
    
    // Simulate AI generation
    const generatedMessages = [];
    for (let i = 0; i < currentState.guests.length; i++) {
        const message = await generateAIMessage(currentState.guests[i], currentState.tone);
        generatedMessages.push({
            ...currentState.guests[i],
            message: message
        });
        
        // Add small delay for realism
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    currentState.generatedMessages = generatedMessages;
    currentState.guests = generatedMessages;
    
    loadingDiv.classList.remove('active');
    
    // Populate edit list
    populateEditList();
    
    // Go to simple edit view
    showSection('simpleEdit');
}

// Simple Edit List
function populateEditList() {
    const container = document.getElementById('editListContainer');
    
    container.innerHTML = currentState.guests.map((guest, index) => `
        <div class="edit-list-item">
            <div class="edit-list-header">
                <span class="edit-list-recipient">${guest.name}</span>
                <span class="edit-list-gift">${guest.gift}</span>
            </div>
            <textarea 
                class="edit-list-textarea" 
                id="edit-${index}"
                onchange="updateMessage(${index}, this.value)"
            >${guest.message}</textarea>
        </div>
    `).join('');
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
    document.getElementById('payAmount').textContent = prices[plan];
    document.getElementById('paymentModal').classList.add('active');
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
        cardElement.mount('#cardElement');
        
        cardElement.on('change', (event) => {
            const errorDiv = document.getElementById('cardErrors');
            errorDiv.textContent = event.error ? event.error.message : '';
        });
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
    const password = document.getElementById('passwordInput').value;
    
    try {
        // 1. Register user first
        const registerRes = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!registerRes.ok) {
            // Try login if already exists
            const loginRes = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!loginRes.ok) throw new Error('Invalid email or password');
            const loginData = await loginRes.json();
            currentState.token = loginData.token;
            currentState.userId = loginData.user.id;
        } else {
            const registerData = await registerRes.json();
            currentState.token = registerData.token;
            currentState.userId = registerData.user.id;
        }
        
        // 2. Create project
        const projectRes = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentState.token}`
            },
            body: JSON.stringify({
                template: currentState.template || 'classic',
                cardsPerPage: currentState.cardsPerPage || 4
            })
        });
        const projectData = await projectRes.json();
        currentState.projectId = projectData.id;
        
        // 3. Upload guest data (convert current guests to cards)
        if (currentState.guests && currentState.guests.length > 0) {
            // Create a simple CSV from guest data
            const csvContent = currentState.guests.map(g => 
                `${g.name},${g.gift},"${g.message || ''}"`
            ).join('\n');
            const blob = new Blob([`Name,Gift,Message\n${csvContent}`], { type: 'text/csv' });
            const formData = new FormData();
            formData.append('file', blob, 'guests.csv');
            
            await fetch(`${API_URL}/projects/${currentState.projectId}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentState.token}` },
                body: formData
            });
        }
        
        // 4. Create payment intent
        const paymentRes = await fetch(`${API_URL}/create-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentState.token}`
            },
            body: JSON.stringify({
                projectId: currentState.projectId,
                plan: currentState.currentPlan || 'premium'
            })
        });
        
        const { clientSecret } = await paymentRes.json();
        
        // 5. Confirm payment with Stripe
        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: { email }
            }
        });
        
        if (error) throw new Error(error.message);
        
        // 6. Confirm on backend (this triggers email)
        await fetch(`${API_URL}/confirm-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentState.token}`
            },
            body: JSON.stringify({
                projectId: currentState.projectId,
                paymentIntentId: paymentIntent.id
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
