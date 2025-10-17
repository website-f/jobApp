// app.js - Fixed version with localStorage
let currentUser = null;
let currentLanguage = 'en';
let currentCurrency = 'MYR';
let selectedUserType = 'seeker';

const currencyRates = { MYR: 1, USD: 0.21, SGD: 0.28 };
const currencySymbols = { MYR: 'RM', USD: '$', SGD: 'S$' };

// Initialize data structure
function initializeData() {
    const data = {
        users: [],
        jobs: generateDummyJobs(),
        applications: [],
        notifications: [],
        contracts: [],
        bids: [],
        reviews: []
    };
    
    Object.keys(data).forEach(key => {
        if (!getData(key)) {
            saveData(key, data[key]);
        }
    });
    
    loadCurrentUser();
}

// Storage functions using localStorage
function saveData(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
}

function getData(key) {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch {
        return null;
    }
}

function loadCurrentUser() {
    const loggedInUser = getData('currentUser');
    if (loggedInUser) {
        currentUser = loggedInUser;
        console.log('User loaded:', currentUser.email, 'Type:', currentUser.type);
        return true;
    }
    return false;
}

// Social Login (Demo with mock delay)
function socialLogin(provider) {
    // ✅ Always prioritize the selectedUserType global variable
    const userTypeField = document.getElementById('userType');
    const userType = selectedUserType || userTypeField?.value || 'seeker';
    
    console.log('=== SOCIAL LOGIN DEBUG ===');
    console.log('Provider:', provider);
    console.log('selectedUserType:', selectedUserType);
    console.log('userTypeField value:', userTypeField?.value);
    console.log('Final userType:', userType);
    console.log('========================');
    
    const modal = document.getElementById('socialLoadingModal');
    const providerSpan = document.getElementById('socialProvider');
    
    providerSpan.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Close any open modals
    closeRegisterModal();
    closeLoginModal();
    
    // Simulate OAuth flow
    setTimeout(() => {
        // Create demo user
        const users = getData('users') || [];
        const demoUser = {
            id: 'user_' + Date.now(),
            name: `Demo ${provider} User`,
            email: `demo.${provider}@example.com`,
            phone: '+60123456789',
            password: 'demo123',
            type: userType,
            location: {
                lat: 3.1390,
                lng: 101.6869,
                address: 'Kuala Lumpur, Malaysia'
            },
            radius: 10,
            skills: [],
            roster: [],
            portfolio: [],
            subscription: 'free',
            rating: 0,
            reviewCount: 0,
            profilePhoto: null,
            resume: null,
            createdAt: new Date().toISOString(),
            socialProvider: provider
        };
        
        console.log('=== CREATING USER ===');
        console.log('User type:', demoUser.type);
        console.log('User object:', demoUser);
        
        users.push(demoUser);
        saveData('users', users);
        
        currentUser = demoUser;
        saveData('currentUser', demoUser);
        
        console.log('User saved to localStorage');
        console.log('Verify localStorage:', window.localStorage.getItem('currentUser'));
        
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        showToast(`Successfully logged in with ${provider}!`, 'success');
        
        console.log('=== REDIRECTING ===');
        console.log('User type:', demoUser.type);
        
        setTimeout(() => {
            if (demoUser.type === 'seeker') {
                console.log('→ Redirecting to seeker dashboard');
                window.location.href = 'seeker-dashboard.html';
            } else if (demoUser.type === 'employer') {
                console.log('→ Redirecting to employer dashboard');
                window.location.href = 'employer-dashboard.html';
            } else {
                console.error('Unknown user type:', demoUser.type);
            }
        }, 500);
    }, 2000);
}

// Generate dummy jobs
function generateDummyJobs() {
    return [
        {
            id: 1,
            title: 'Barista',
            company: 'Coffee House',
            type: 'part-time',
            salary: 12,
            location: 'Kuala Lumpur',
            address: 'Jalan Bukit Bintang, Kuala Lumpur',
            lat: 3.1478,
            lng: 101.7019,
            description: 'Looking for an experienced barista for weekend shifts',
            skills: ['customer-service', 'coffee-making'],
            schedule: [
                { date: '2025-10-25', day: 'saturday', times: [{start: '08:00', end: '16:00'}] },
                { date: '2025-10-26', day: 'sunday', times: [{start: '08:00', end: '16:00'}] }
            ],
            posted: new Date().toISOString(),
            employerId: 'emp1'
        },
        {
            id: 2,
            title: 'Delivery Driver',
            company: 'Quick Delivery Co',
            type: 'full-time',
            salary: 2500,
            location: 'Petaling Jaya',
            address: 'SS2, Petaling Jaya, Selangor',
            lat: 3.1177,
            lng: 101.6153,
            description: 'Full-time delivery driver needed. Own vehicle required.',
            skills: ['driving', 'navigation'],
            schedule: [
                { date: '2025-10-20', day: 'monday', times: [{start: '09:00', end: '18:00'}] },
                { date: '2025-10-21', day: 'tuesday', times: [{start: '09:00', end: '18:00'}] },
                { date: '2025-10-22', day: 'wednesday', times: [{start: '09:00', end: '18:00'}] },
                { date: '2025-10-23', day: 'thursday', times: [{start: '09:00', end: '18:00'}] },
                { date: '2025-10-24', day: 'friday', times: [{start: '09:00', end: '18:00'}] }
            ],
            posted: new Date().toISOString(),
            employerId: 'emp2'
        }
    ];
}

// Modal functions
function showRegisterModal(userType) {
    selectedUserType = userType;
    console.log('=== SHOW REGISTER MODAL ===');
    console.log('Setting selectedUserType to:', userType);
    document.getElementById('userType').value = userType;
    console.log('Hidden field value:', document.getElementById('userType').value);
    document.getElementById('registerModal').classList.remove('hidden');
    document.getElementById('registerModal').classList.add('flex');
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
    document.getElementById('registerModal').classList.remove('flex');
}

function showLoginModal() {
    // Don't reset selectedUserType when switching to login
    console.log('showLoginModal - Current selectedUserType:', selectedUserType);
    closeRegisterModal();
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('loginModal').classList.add('flex');
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('loginModal').classList.remove('flex');
}

// Handle registration
function handleRegister(event) {
    event.preventDefault();
    
    const userType = document.getElementById('userType').value;
    console.log('handleRegister - userType:', userType);
    
    const users = getData('users') || [];
    const newUser = {
        id: 'user_' + Date.now(),
        name: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        password: document.getElementById('password').value,
        type: userType,
        location: {
            lat: 3.1390,
            lng: 101.6869,
            address: 'Kuala Lumpur, Malaysia'
        },
        radius: 10,
        skills: [],
        roster: [],
        portfolio: [],
        subscription: 'free',
        rating: 0,
        reviewCount: 0,
        profilePhoto: null,
        resume: null,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveData('users', users);
    
    currentUser = newUser;
    saveData('currentUser', newUser);
    
    console.log('User registered:', newUser.email, 'Type:', newUser.type);
    
    closeRegisterModal();
    
    setTimeout(() => {
        if (newUser.type === 'seeker') {
            console.log('Redirecting to seeker dashboard');
            window.location.href = 'seeker-dashboard.html';
        } else {
            console.log('Redirecting to employer dashboard');
            window.location.href = 'employer-dashboard.html';
        }
    }, 100);
}

// Handle login
function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const users = getData('users') || [];
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUser = user;
        saveData('currentUser', user);
        
        console.log('User logged in:', user.email, 'Type:', user.type);
        
        closeLoginModal();
        
        setTimeout(() => {
            if (user.type === 'seeker') {
                console.log('Redirecting to seeker dashboard');
                window.location.href = 'seeker-dashboard.html';
            } else {
                console.log('Redirecting to employer dashboard');
                window.location.href = 'employer-dashboard.html';
            }
        }, 100);
    } else {
        showToast('Invalid email or password', 'error');
    }
}

// Logout function
function logout() {
    saveData('currentUser', null);
    currentUser = null;
    console.log('User logged out');
    window.location.href = 'index.html';
}

// Currency conversion
function convertCurrency(amount, fromCurrency = 'MYR') {
    const myrAmount = amount / currencyRates[fromCurrency];
    return (myrAmount * currencyRates[currentCurrency]).toFixed(2);
}

function formatCurrency(amount) {
    return `${currencySymbols[currentCurrency]}${convertCurrency(amount)}`;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Update prices when currency changes
function updatePrices() {
    document.querySelectorAll('[data-price]').forEach(el => {
        const basePrice = parseFloat(el.dataset.price);
        el.textContent = formatCurrency(basePrice);
    });
}

// Add notification
function addNotification(userId, message, type = 'info') {
    const notifications = getData('notifications') || [];
    notifications.push({
        id: Date.now(),
        userId,
        message,
        type,
        read: false,
        timestamp: new Date().toISOString()
    });
    saveData('notifications', notifications);
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'warning' ? 'bg-orange-500' : 
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    } text-white font-medium`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Language selector
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    
    const langSelector = document.getElementById('languageSelector');
    if (langSelector) {
        langSelector.value = currentLanguage;
        langSelector.addEventListener('change', (e) => {
            currentLanguage = e.target.value;
            saveData('language', currentLanguage);
        });
    }
    
    const currSelector = document.getElementById('currencySelector');
    if (currSelector) {
        currSelector.value = currentCurrency;
        currSelector.addEventListener('change', (e) => {
            currentCurrency = e.target.value;
            saveData('currency', currentCurrency);
            updatePrices();
        });
    }
    
    const savedLang = getData('language');
    const savedCurr = getData('currency');
    
    if (savedLang) {
        currentLanguage = savedLang;
        if (langSelector) langSelector.value = savedLang;
    }
    
    if (savedCurr) {
        currentCurrency = savedCurr;
        if (currSelector) currSelector.value = savedCurr;
    }
});