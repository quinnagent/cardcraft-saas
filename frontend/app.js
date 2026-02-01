// CardCraft Frontend JavaScript

// Auto-detect API URL based on environment
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api'
  : 'https://cardcraft-api.up.railway.app/api'; // Change this to your deployed backend URL

let currentProject = null;
let currentCards = [];
let selectedTemplate = null;

// Auth functions
async function register(email, password) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  }
  throw new Error(data.error);
}

async function login(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  }
  throw new Error(data.error);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.reload();
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Project functions
async function createProject(template) {
  const res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ template })
  });
  return res.json();
}

async function uploadCSV(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_URL}/projects/${projectId}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  });
  return res.json();
}

async function getCards(projectId, preview = false) {
  const res = await fetch(`${API_URL}/projects/${projectId}/cards?preview=${preview}`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

async function getCardCount(projectId) {
  const res = await fetch(`${API_URL}/projects/${projectId}/cards/count`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

async function updateCard(cardId, message) {
  const res = await fetch(`${API_URL}/cards/${cardId}`, {
    method: 'PUT',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  return res.json();
}

// Payment functions
async function createPayment(projectId, plan) {
  const res = await fetch(`${API_URL}/create-payment`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, plan })
  });
  return res.json();
}

async function confirmPayment(projectId, paymentIntentId) {
  const res = await fetch(`${API_URL}/confirm-payment`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, paymentIntentId })
  });
  return res.json();
}

// UI Functions
function showAuthModal() {
  document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function updateUIForAuth() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const authSection = document.getElementById('authSection');
  
  if (user) {
    authSection.innerHTML = `
      <span>Hello, ${user.email}</span>
      <button class="btn btn-outline" onclick="logout()">Logout</button>
    `;
  } else {
    authSection.innerHTML = `
      <button class="btn btn-outline" onclick="showAuthModal()">Login</button>
    `;
  }
}

// Template selection
document.querySelectorAll('.template-card').forEach(card => {
  card.addEventListener('click', async () => {
    if (!localStorage.getItem('token')) {
      showAuthModal();
      return;
    }
    
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedTemplate = card.dataset.template;
    
    // Create project
    const project = await createProject(selectedTemplate);
    currentProject = project;
    
    // Show upload section
    document.getElementById('uploadSection').scrollIntoView({ behavior: 'smooth' });
  });
});

// File upload
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');

uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', async (e) => {
  e.preventDefault();
  uploadBox.classList.remove('dragover');
  
  if (!currentProject) {
    alert('Please select a template first');
    return;
  }
  
  const files = e.dataTransfer.files;
  if (files.length) await handleUpload(files[0]);
});

fileInput.addEventListener('change', async (e) => {
  if (!currentProject) {
    alert('Please select a template first');
    return;
  }
  
  if (e.target.files.length) await handleUpload(e.target.files[0]);
});

async function handleUpload(file) {
  uploadBox.innerHTML = '<p>Uploading...</p>';
  
  try {
    const result = await uploadCSV(currentProject.id, file);
    uploadBox.innerHTML = `<p>✓ Uploaded ${result.count} cards!</p>`;
    
    // Get total count
    const countResult = await getCardCount(currentProject.id);
    currentProject.totalCards = countResult.total;
    
    // Load only 4 preview cards
    const previewResult = await getCards(currentProject.id, true);
    currentCards = previewResult.cards;
    currentProject.isPreview = previewResult.isPreview;
    currentProject.isPaid = previewResult.isPaid;
    
    showPreview();
  } catch (err) {
    uploadBox.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
  }
}

function showPreview() {
  document.getElementById('previewSection').classList.add('active');
  document.getElementById('previewSection').scrollIntoView({ behavior: 'smooth' });
  
  renderCard(0);
  updateCardCounter();
}

function renderCard(index) {
  const card = currentCards[index];
  if (!card) return;

  const cardIndexInput = document.getElementById('cardIndex');
  const recipientEl = document.getElementById('recipientName');
  const messageEl = document.getElementById('cardMessage');
  const giftEl = document.getElementById('giftNote');

  if (cardIndexInput) cardIndexInput.value = index;
  if (recipientEl) recipientEl.textContent = `Dear ${card.recipient_name},`;
  if (messageEl) messageEl.value = card.message;
  if (giftEl) giftEl.textContent = card.gift ? `Gift: ${card.gift}` : '';
}

function updateCardCounter() {
  const index = parseInt(document.getElementById('cardIndex')?.value || 0);
  const counterEl = document.getElementById('cardCounter');
  const upgradeEl = document.getElementById('upgradePrompt');

  if (!counterEl) return;

  if (currentProject.isPreview) {
    counterEl.textContent = `Preview: Card ${index + 1} of ${currentCards.length} (4 of ${currentProject.totalCards} total)`;

    // Show upgrade prompt
    if (upgradeEl) {
      upgradeEl.style.display = 'block';
      upgradeEl.innerHTML = `
        <div style="background: #f0ece5; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: center;">
          <p style="margin-bottom: 15px; font-weight: 500;">You're viewing 4 of ${currentProject.totalCards} cards</p>
          <p style="margin-bottom: 15px; color: #666; font-size: 14px;">Upgrade to unlock all cards and download your print-ready PDF</p>
          <button class="btn" onclick="scrollToPricing()" style="background: var(--primary); color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Unlock All Cards - $39</button>
        </div>
      `;
    }
  } else {
    counterEl.textContent = `Card ${index + 1} of ${currentCards.length}`;
    if (upgradeEl) upgradeEl.style.display = 'none';
  }
}

document.getElementById('prevCard')?.addEventListener('click', () => {
  const index = parseInt(document.getElementById('cardIndex').value || 0);
  if (index > 0) {
    saveCurrentCard();
    renderCard(index - 1);
    updateCardCounter();
  }
});

document.getElementById('nextCard')?.addEventListener('click', () => {
  const index = parseInt(document.getElementById('cardIndex').value || 0);
  if (index < currentCards.length - 1) {
    saveCurrentCard();
    renderCard(index + 1);
    updateCardCounter();
  }
});

async function saveCurrentCard() {
  const index = parseInt(document.getElementById('cardIndex').value || 0);
  const message = document.getElementById('cardMessage').value;
  const card = currentCards[index];
  
  await updateCard(card.id, message);
  currentCards[index].message = message;
}

// Payment
document.querySelectorAll('.pricing-card button').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!currentProject) {
      alert('Please create a project first');
      return;
    }
    
    const plan = btn.dataset.plan;
    showPaymentModal(plan);
  });
});

function showPaymentModal(plan) {
  document.getElementById('paymentModal').classList.add('active');
  document.getElementById('selectedPlan').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
}

function scrollToPricing() {
  document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
}

// Initialize Stripe Elements
let stripe, cardElement;

async function initStripe() {
  stripe = Stripe('pk_test_your_publishable_key');
  const elements = stripe.elements();
  cardElement = elements.create('card');
  cardElement.mount('#cardElement');
}

document.getElementById('paymentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const plan = document.getElementById('selectedPlan').textContent.toLowerCase();
  
  try {
    // Create payment intent
    const { clientSecret } = await createPayment(currentProject.id, plan);
    
    // Confirm card payment
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement }
    });
    
    if (result.error) {
      document.getElementById('paymentError').textContent = result.error.message;
    } else {
      // Payment successful, generate PDF
      const confirm = await confirmPayment(currentProject.id, result.paymentIntent.id);
      
      if (confirm.success) {
        closePaymentModal();
        currentProject.isPaid = true;
        currentProject.isPreview = false;

        // Reload all cards (not just preview)
        const allCardsResult = await getCards(currentProject.id, false);
        currentCards = allCardsResult.cards;

        // Update UI
        updateCardCounter();
        renderCard(0);

        // Show download section
        document.getElementById('downloadSection').classList.add('active');
        document.getElementById('downloadLink').href = `${API_URL}/download/${currentProject.id}`;
      }
    }
  } catch (err) {
    document.getElementById('paymentError').textContent = err.message;
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateUIForAuth();
  initStripe();
});