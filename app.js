// Initialize app
let currentUser = null;
let currentLanguage = 'en';
let currentCurrency = 'MYR';

// Currency rates (base: MYR)
const currencyRates = {
    MYR: 1,
    USD: 0.21,
    SGD: 0.28
};

const currencySymbols = {
    MYR: 'RM',
    USD: '$',
    SGD: 'S$'
};

// Initialize data structure
function initializeData() {
    if (!window.localStorage.getItem('users')) {
        window.localStorage.setItem('users', JSON.stringify([]));
    }
    if (!window.localStorage.getItem('jobs')) {
        window.localStorage.setItem('jobs', JSON.stringify(generateDummyJobs()));
    }
    if (!window.localStorage.getItem('applications')) {
        window.localStorage.setItem('applications', JSON.stringify([]));
    }
    if (!window.localStorage.getItem('notifications')) {
        window.localStorage.setItem('notifications', JSON.stringify([]));
    }
    if (!window.localStorage.getItem('contracts')) {
        window.localStorage.setItem('contracts', JSON.stringify([]));
    }
    if (!window.localStorage.getItem('bids')) {
        window.localStorage.setItem('bids', JSON.stringify([]));
    }
    if (!window.localStorage.getItem('reviews')) {
        window.localStorage.setItem('reviews', JSON.stringify([]));
    }
    
    // Check if user is logged in
    loadCurrentUser();
}

// Load current user from localStorage
function loadCurrentUser() {
    try {
        const loggedInUser = window.localStorage.getItem('currentUser');
        if (loggedInUser) {
            currentUser = JSON.parse(loggedInUser);
            console.log('User loaded:', currentUser.email);
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error loading user:', e);
        return false;
    }
}

// Check if user should be on this page
function checkAuth(requiredType) {
    if (!loadCurrentUser()) {
        console.log('No user found, redirecting to index');
        window.location.href = 'index.html';
        return false;
    }
    
    if (requiredType && currentUser.type !== requiredType) {
        console.log('Wrong user type, redirecting');
        if (currentUser.type === 'seeker') {
            window.location.href = 'seeker-dashboard.html';
        } else {
            window.location.href = 'employer-dashboard.html';
        }
        return false;
    }
    
    return true;
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
            lat: 3.1390,
            lng: 101.6869,
            description: 'Looking for an experienced barista for weekend shifts',
            skills: ['customer-service', 'coffee-making'],
            schedule: {
                type: 'weekly',
                days: ['saturday', 'sunday'],
                times: '08:00-16:00'
            },
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
            lat: 3.1073,
            lng: 101.6067,
            description: 'Full-time delivery driver needed. Own vehicle required.',
            skills: ['driving', 'navigation'],
            schedule: {
                type: 'weekly',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                times: '09:00-18:00'
            },
            posted: new Date().toISOString(),
            employerId: 'emp2'
        },
        {
            id: 3,
            title: 'Retail Assistant',
            company: 'Fashion Store',
            type: 'part-time',
            salary: 10,
            location: 'Subang Jaya',
            lat: 3.0441,
            lng: 101.5866,
            description: 'Part-time retail assistant for evening shifts',
            skills: ['customer-service', 'sales'],
            schedule: {
                type: 'weekly',
                days: ['monday', 'wednesday', 'friday'],
                times: '16:00-22:00'
            },
            posted: new Date().toISOString(),
            employerId: 'emp1'
        }
    ];
}

// Modal functions
function showRegisterModal(userType) {
    document.getElementById('userType').value = userType;
    document.getElementById('registerModal').classList.remove('hidden');
    document.getElementById('registerModal').classList.add('flex');
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
    document.getElementById('registerModal').classList.remove('flex');
}

function showLoginModal() {
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
    
    const users = JSON.parse(window.localStorage.getItem('users'));
    const newUser = {
        id: 'user_' + Date.now(),
        name: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        password: document.getElementById('password').value,
        type: document.getElementById('userType').value,
        location: { lat: 3.1390, lng: 101.6869 }, // Default: KL
        radius: 10, // Default 10km
        skills: [],
        roster: {},
        portfolio: [],
        subscription: 'free',
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    window.localStorage.setItem('users', JSON.stringify(users));
    
    // Auto login
    currentUser = newUser;
    window.localStorage.setItem('currentUser', JSON.stringify(newUser));
    
    console.log('User registered and logged in:', newUser.email);
    
    closeRegisterModal();
    
    // Small delay to ensure localStorage is saved
    setTimeout(() => {
        // Redirect based on user type
        if (newUser.type === 'seeker') {
            window.location.href = 'seeker-dashboard.html';
        } else {
            window.location.href = 'employer-dashboard.html';
        }
    }, 100);
}

// Handle login
function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const users = JSON.parse(window.localStorage.getItem('users'));
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUser = user;
        window.localStorage.setItem('currentUser', JSON.stringify(user));
        
        console.log('User logged in:', user.email);
        
        closeLoginModal();
        
        // Small delay to ensure localStorage is saved
        setTimeout(() => {
            if (user.type === 'seeker') {
                window.location.href = 'seeker-dashboard.html';
            } else {
                window.location.href = 'employer-dashboard.html';
            }
        }, 100);
    } else {
        alert(getTranslation ? getTranslation('login.error') : 'Invalid email or password');
    }
}

// Logout function
function logout() {
    window.localStorage.removeItem('currentUser');
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

// Language selector
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    
    // Set up language selector
    const langSelector = document.getElementById('languageSelector');
    if (langSelector) {
        langSelector.value = currentLanguage;
        langSelector.addEventListener('change', (e) => {
            currentLanguage = e.target.value;
            window.localStorage.setItem('language', currentLanguage);
            if (typeof updateTranslations === 'function') {
                updateTranslations();
            }
        });
    }
    
    // Set up currency selector
    const currSelector = document.getElementById('currencySelector');
    if (currSelector) {
        currSelector.value = currentCurrency;
        currSelector.addEventListener('change', (e) => {
            currentCurrency = e.target.value;
            window.localStorage.setItem('currency', currentCurrency);
            updatePrices();
        });
    }
    
    // Load saved preferences
    const savedLang = window.localStorage.getItem('language');
    const savedCurr = window.localStorage.getItem('currency');
    
    if (savedLang) {
        currentLanguage = savedLang;
        if (langSelector) langSelector.value = savedLang;
    }
    
    if (savedCurr) {
        currentCurrency = savedCurr;
        if (currSelector) currSelector.value = savedCurr;
    }
    
    if (typeof updateTranslations === 'function') {
        updateTranslations();
    }
});

// Get user location
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                error => {
                    // Default to KL if location access denied
                    resolve({ lat: 3.1390, lng: 101.6869 });
                }
            );
        } else {
            resolve({ lat: 3.1390, lng: 101.6869 });
        }
    });
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
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
    const notifications = JSON.parse(window.localStorage.getItem('notifications'));
    notifications.push({
        id: Date.now(),
        userId,
        message,
        type,
        read: false,
        timestamp: new Date().toISOString()
    });
    window.localStorage.setItem('notifications', JSON.stringify(notifications));
}

// Service Worker registration (only works on http/https, not file://)
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}