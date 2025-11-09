// Load current user first before checking
(function() {
    try {
        const loggedInUser = window.localStorage.getItem('currentUser');
        if (!loggedInUser) {
            console.log('No user found, redirecting to index');
            window.location.href = 'index.html';
            return;
        }
        currentUser = JSON.parse(loggedInUser);
        
        if (currentUser.type !== 'seeker') {
            console.log('Wrong user type, redirecting to employer dashboard');
            window.location.href = 'employer-dashboard.html';
            return;
        }
        
        console.log('Seeker authenticated:', currentUser.email);
    } catch (e) {
        console.error('Error loading user:', e);
        window.location.href = 'index.html';
    }
})();

let currentJobId = null;
let map = null;
let userMarker = null;
let jobMarkers = [];
let selectedDate = null; // For calendar
let currentSkillForCert = null; // For skill certificate upload

// Geocoding function to convert address to coordinates
async function geocodeAddress(address) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                displayName: data[0].display_name
            };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

// Reverse geocoding function to convert coordinates to address
async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

// Update location from address input
async function updateLocationFromAddress() {
    const addressInput = document.getElementById('addressInput');
    const address = addressInput.value.trim();
    
    if (!address) {
        showToast('Please enter an address', 'warning');
        return;
    }
    
    showToast('Searching for address...', 'info');
    
    const result = await geocodeAddress(address);
    
    if (result) {
        currentUser.location = {
            lat: result.lat,
            lng: result.lng,
            address: result.displayName
        };
        updateUser();
        
        document.getElementById('locationText').textContent = `Your location: ${result.displayName}`;
        
        // Update map
        if (map) {
            map.setView([result.lat, result.lng], 13);
            if (userMarker) {
                userMarker.setLatLng([result.lat, result.lng]);
            }
        }
        
        showToast('Location updated successfully!', 'success');
        searchJobs();
    } else {
        showToast('Address not found. Please try a different address.', 'error');
    }
}

// Get user's current location using GPS
async function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const address = await reverseGeocode(lat, lng);
                resolve({ lat, lng, address });
            },
            error => reject(error)
        );
    });
}

// Initialize location on load
async function initLocation() {
    try {
        if (!currentUser.location || !currentUser.location.lat) {
            const position = await getUserLocation();
            currentUser.location = position;
            updateUser();
        } else if (!currentUser.location.address) {
            // If we have coordinates but no address, reverse geocode
            const address = await reverseGeocode(currentUser.location.lat, currentUser.location.lng);
            currentUser.location.address = address;
            updateUser();
        }
        
        document.getElementById('addressInput').value = currentUser.location.address || '';
        document.getElementById('locationText').textContent = 
            `Your location: ${currentUser.location.address || 'Unknown'}`;
        
        initMap();
    } catch (error) {
        console.error('Location error:', error);
        showToast('Could not get location. Please enter manually.', 'warning');
        // Default to a central location
        currentUser.location = { lat: 3.1390, lng: 101.6869, address: 'Kuala Lumpur, Malaysia' };
        updateUser();
        initMap();
    }
}

// Initialize the Leaflet map
function initMap() {
    if (map) {
        map.remove();
    }
    
    const userLat = currentUser.location.lat;
    const userLng = currentUser.location.lng;
    
    map = L.map('map').setView([userLat, userLng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add user marker
    const userIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #4f46e5; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    userMarker = L.marker([userLat, userLng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>Your Location</b>');
    
    // Add radius circle
    updateRadiusCircle();
    
    // Load jobs on map
    loadJobsOnMap();
}

let radiusCircle = null;

function updateRadiusCircle() {
    if (radiusCircle) {
        map.removeLayer(radiusCircle);
    }
    
    const radius = parseFloat(document.getElementById('radiusSlider').value) * 1000; // Convert to meters
    
    radiusCircle = L.circle([currentUser.location.lat, currentUser.location.lng], {
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.1,
        radius: radius
    }).addTo(map);
}

function loadJobsOnMap() {
    // Clear existing job markers
    jobMarkers.forEach(marker => map.removeLayer(marker));
    jobMarkers = [];
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs')) || [];
    const radius = parseFloat(document.getElementById('radiusSlider').value);
    
    jobs.forEach(job => {
        const distance = calculateDistance(
            currentUser.location.lat,
            currentUser.location.lng,
            job.lat,
            job.lng
        );
        
        if (distance <= radius) {
            const jobIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #10b981; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
                iconSize: [25, 25],
                iconAnchor: [12.5, 12.5]
            });
            
            const marker = L.marker([job.lat, job.lng], { icon: jobIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="min-width: 150px;">
                        <h4 style="margin: 0 0 8px 0; font-weight: bold;">${job.title}</h4>
                        <p style="margin: 4px 0; font-size: 13px;">${job.company}</p>
                        <p style="margin: 4px 0; font-size: 12px; color: #666;">${distance.toFixed(1)} km away</p>
                        <button onclick="showJobDetails(${job.id})" style="margin-top: 8px; background: #6366f1; color: white; padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; width: 100%;">View Details</button>
                    </div>
                `);
            
            jobMarkers.push(marker);
        }
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('radiusSlider');
    const valueDisplay = document.getElementById('radiusValue');
    
    if (slider && valueDisplay) {
        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = `${e.target.value} km`;
            updateRadiusCircle();
            searchJobs();
            loadJobsOnMap();
        });
    }
    
    initLocation();
    initCalendar(); // Initialize calendar for roster
    searchJobs();
    loadProfile();
    loadSkills();
    loadRoster();
    loadContracts();
    loadPortfolio();
    loadResume();
    loadProfilePhoto();
    loadCertificates(); // Load general certificates
});

// Tab switching
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active', 'text-indigo-600'));
    
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) {
        btn.classList.add('tab-active', 'text-indigo-600');
    }
    
    // Refresh calendar when switching to roster tab
    if (tabName === 'roster') {
        initCalendar();
    }
}

// Enhanced job search with matching
function searchJobs() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('jobTypeFilter').value;
    const radius = parseFloat(document.getElementById('radiusSlider').value);
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs')) || [];
    const userLat = currentUser.location.lat;
    const userLng = currentUser.location.lng;
    const userSkills = currentUser.skills || [];
    const userRoster = currentUser.roster || [];
    
    let totalJobs = 0;
    let matchedJobs = 0;
    
    const filteredJobs = jobs.filter(job => {
        totalJobs++;
        
        // Distance check
        const distance = calculateDistance(userLat, userLng, job.lat, job.lng);
        if (distance > radius) return false;
        
        // Search check
        const matchesSearch = !search || 
            job.title.toLowerCase().includes(search) || 
            job.company.toLowerCase().includes(search);
        if (!matchesSearch) return false;
        
        // Type check
        const matchesType = !typeFilter || job.type === typeFilter;
        if (!matchesType) return false;
        
        matchedJobs++;
        return true;
    });
    
    // Update match info
    const matchInfo = document.getElementById('matchInfo');
    if (matchInfo) {
        if (filteredJobs.length === 0) {
            matchInfo.innerHTML = `<span class="text-orange-600">⚠️ No jobs match your criteria. Try updating your filters.</span>`;
        } else {
            matchInfo.innerHTML = `<span class="text-green-600">✓ Found ${filteredJobs.length} job(s) matching your profile</span>`;
        }
    }
    
    displayJobs(filteredJobs);
}

function displayJobs(jobs) {
    const container = document.getElementById('jobListings');
    
    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p class="text-gray-500 mb-2">No jobs found matching your criteria</p>
                <p class="text-sm text-gray-400">Try expanding your radius or updating your skills</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = jobs.map(job => {
        const distance = calculateDistance(currentUser.location.lat, currentUser.location.lng, job.lat, job.lng);
        const matchingSkills = job.skills.filter(skill => currentUser.skills.includes(skill));
        const skillMatch = currentUser.skills.length > 0 ? 
            Math.round((matchingSkills.length / job.skills.length) * 100) : 0;
        
        return `
            <div class="bg-white rounded-xl shadow-lg p-6 card-hover cursor-pointer hover:shadow-xl transition-shadow" onclick="showJobDetails(${job.id})">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${job.title}</h3>
                        <p class="text-gray-600">${job.company}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="badge ${job.type === 'full-time' ? 'badge-primary' : 'badge-success'}">${job.type}</span>
                        ${skillMatch > 0 ? `<span class="text-xs text-green-600 font-semibold">${skillMatch}% Match</span>` : ''}
                    </div>
                </div>
                <div class="flex items-center text-gray-600 text-sm mb-2">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    </svg>
                    ${job.location} (${distance.toFixed(1)} km away)
                </div>
                <div class="flex items-center text-gray-600 text-sm mb-3">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                    </svg>
                    <span data-price="${job.salary}">${formatCurrency(job.salary)}</span>
                    ${job.type === 'part-time' ? '/hour' : '/month'}
                </div>
                <div class="flex flex-wrap gap-2">
                    ${job.skills.map(skill => {
                        const isMatched = currentUser.skills.includes(skill);
                        return `<span class="badge ${isMatched ? 'badge-success' : 'badge-primary'}">${skill}${isMatched ? ' ✓' : ''}</span>`;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// FIX: Make sure showJobDetails works properly
function showJobDetails(jobId) {
    const jobs = JSON.parse(window.localStorage.getItem('jobs')) || [];
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    currentJobId = jobId;
    
    const distance = calculateDistance(currentUser.location.lat, currentUser.location.lng, job.lat, job.lng);
    const matchingSkills = job.skills.filter(skill => currentUser.skills.includes(skill));
    
    // Handle schedule display - check if days is array or string
    let scheduleDisplay = '';
    if (job.schedule && job.schedule.days) {
        if (Array.isArray(job.schedule.days)) {
            // Array format: ["monday", "tuesday"]
            scheduleDisplay = '["monday", "tuesday"]';
        } else if (typeof job.schedule.days === 'string') {
            // String format: "Monday, Tuesday"
            scheduleDisplay = job.schedule.days;
        }
    }
    
    const content = `
        <div class="space-y-4">
            <div>
                <h4 class="text-2xl font-bold mb-2">${job.title}</h4>
                <p class="text-lg text-gray-600">${job.company}</p>
            </div>
            
            <div class="flex gap-2">
                <span class="badge ${job.type === 'full-time' ? 'badge-primary' : 'badge-success'}">${job.type}</span>
                ${matchingSkills.length > 0 ? `<span class="badge badge-success">${matchingSkills.length}/${job.skills.length} Skills Match</span>` : ''}
            </div>
            
            <div class="border-t pt-4">
                <h5 class="font-bold mb-2">Salary</h5>
                <p class="text-xl text-indigo-600" data-price="${job.salary}">
                    ${formatCurrency(job.salary)} ${job.type === 'part-time' ? '/hour' : '/month'}
                </p>
            </div>
            
            <div class="border-t pt-4">
                <h5 class="font-bold mb-2">Location</h5>
                <p class="text-gray-600">${job.location} (${distance.toFixed(1)} km from you)</p>
            </div>
            
            <div class="border-t pt-4">
                <h5 class="font-bold mb-2">Schedule</h5>
                <p class="text-gray-600">
                    ${scheduleDisplay}<br>
                    ${job.schedule && job.schedule.times ? job.schedule.times : 'Schedule to be determined'}
                </p>
            </div>
            
            <div class="border-t pt-4">
                <h5 class="font-bold mb-2">Required Skills</h5>
                <div class="flex flex-wrap gap-2">
                    ${job.skills.map(skill => {
                        const isMatched = currentUser.skills.includes(skill);
                        return `<span class="badge ${isMatched ? 'badge-success' : 'badge-primary'}">${skill}${isMatched ? ' ✓' : ''}</span>`;
                    }).join('')}
                </div>
            </div>
            
            <div class="border-t pt-4">
                <h5 class="font-bold mb-2">Description</h5>
                <p class="text-gray-600">${job.description}</p>
            </div>
            
            <div class="flex gap-3 pt-4">
                <button onclick="applyForJob()" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">
                    Apply Now
                </button>
                <button onclick="showBidModal()" class="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
                    Place Bid
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('jobModalContent').innerHTML = content;
    document.getElementById('jobModal').classList.remove('hidden');
    document.getElementById('jobModal').classList.add('flex');
}

function closeJobModal() {
    document.getElementById('jobModal').classList.add('hidden');
    document.getElementById('jobModal').classList.remove('flex');
}

function applyForJob() {
    const applications = JSON.parse(window.localStorage.getItem('applications')) || [];
    
    const existing = applications.find(app => 
        app.jobId === currentJobId && app.seekerId === currentUser.id
    );
    
    if (existing) {
        showToast('You have already applied for this job', 'warning');
        return;
    }
    
    applications.push({
        id: Date.now(),
        jobId: currentJobId,
        seekerId: currentUser.id,
        status: 'pending',
        appliedAt: new Date().toISOString()
    });
    
    window.localStorage.setItem('applications', JSON.stringify(applications));
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs')) || [];
    const job = jobs.find(j => j.id === currentJobId);
    if (job) {
        addNotification(job.employerId, `${currentUser.name} applied for ${job.title}`, 'info');
    }
    
    showToast('Application submitted successfully!', 'success');
    closeJobModal();
}

function showBidModal() {
    closeJobModal();
    document.getElementById('bidModal').classList.remove('hidden');
    document.getElementById('bidModal').classList.add('flex');
}

function closeBidModal() {
    document.getElementById('bidModal').classList.add('hidden');
    document.getElementById('bidModal').classList.remove('flex');
}

function submitBid() {
    const amount = document.getElementById('bidAmount').value;
    const message = document.getElementById('bidMessage').value;
    
    if (!amount) {
        showToast('Please enter bid amount', 'warning');
        return;
    }
    
    const bids = JSON.parse(window.localStorage.getItem('bids')) || [];
    bids.push({
        id: Date.now(),
        jobId: currentJobId,
        seekerId: currentUser.id,
        amount: parseFloat(amount),
        message,
        status: 'pending',
        createdAt: new Date().toISOString()
    });
    
    window.localStorage.setItem('bids', JSON.stringify(bids));
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs')) || [];
    const job = jobs.find(j => j.id === currentJobId);
    if (job) {
        addNotification(job.employerId, `${currentUser.name} placed a bid on ${job.title}`, 'info');
    }
    
    showToast('Bid submitted successfully!', 'success');
    closeBidModal();
    document.getElementById('bidAmount').value = '';
    document.getElementById('bidMessage').value = '';
}

// ========== CALENDAR FUNCTIONS FOR ROSTER ==========
function initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day disabled';
        calendarDays.appendChild(emptyDay);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        dayElement.dataset.date = dateStr;
        
        // Check if this date has time slots
        if (currentUser.roster && currentUser.roster.some(r => r.date === dateStr)) {
            dayElement.classList.add('has-slots');
        }
        
        dayElement.onclick = () => selectDate(dateStr);
        calendarDays.appendChild(dayElement);
    }
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    
    // Update UI
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
        if (day.dataset.date === dateStr) {
            day.classList.add('selected');
        }
    });
    
    const date = new Date(dateStr);
    document.getElementById('selectedDateText').textContent = date.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    document.getElementById('timeSlotsSection').classList.remove('hidden');
    loadTimeSlotsForDate(dateStr);
}

function loadTimeSlotsForDate(dateStr) {
    const rosterEntry = currentUser.roster ? currentUser.roster.find(r => r.date === dateStr) : null;
    const container = document.getElementById('timeSlotsList');
    
    if (!rosterEntry || !rosterEntry.timeSlots || rosterEntry.timeSlots.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No time slots added yet</p>';
        return;
    }
    
    container.innerHTML = rosterEntry.timeSlots.map((slot, index) => `
        <div class="time-slot-item">
            <input type="time" value="${slot.start}" onchange="updateTimeSlot(${index}, 'start', this.value)" class="flex-1 px-2 py-1 border rounded text-sm">
            <span class="text-gray-500">to</span>
            <input type="time" value="${slot.end}" onchange="updateTimeSlot(${index}, 'end', this.value)" class="flex-1 px-2 py-1 border rounded text-sm">
            <button onclick="removeTimeSlotFromDate(${index})" class="text-red-600 hover:text-red-700 px-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function addTimeSlotToDate() {
    if (!selectedDate) return;
    
    if (!currentUser.roster) currentUser.roster = [];
    
    let rosterEntry = currentUser.roster.find(r => r.date === selectedDate);
    if (!rosterEntry) {
        rosterEntry = { date: selectedDate, timeSlots: [] };
        currentUser.roster.push(rosterEntry);
    }
    
    rosterEntry.timeSlots.push({ start: '09:00', end: '17:00' });
    loadTimeSlotsForDate(selectedDate);
    updateCalendarDisplay();
}

function updateTimeSlot(index, field, value) {
    if (!selectedDate) return;
    
    const rosterEntry = currentUser.roster.find(r => r.date === selectedDate);
    if (rosterEntry && rosterEntry.timeSlots[index]) {
        rosterEntry.timeSlots[index][field] = value;
    }
}

function removeTimeSlotFromDate(index) {
    if (!selectedDate) return;
    
    const rosterEntry = currentUser.roster.find(r => r.date === selectedDate);
    if (rosterEntry) {
        rosterEntry.timeSlots.splice(index, 1);
        
        // Remove entry if no time slots left
        if (rosterEntry.timeSlots.length === 0) {
            currentUser.roster = currentUser.roster.filter(r => r.date !== selectedDate);
        }
        
        loadTimeSlotsForDate(selectedDate);
        updateCalendarDisplay();
    }
}

function updateCalendarDisplay() {
    document.querySelectorAll('.calendar-day').forEach(day => {
        const dateStr = day.dataset.date;
        if (dateStr) {
            day.classList.remove('has-slots');
            if (currentUser.roster && currentUser.roster.some(r => r.date === dateStr)) {
                day.classList.add('has-slots');
            }
        }
    });
}

function saveRoster() {
    updateUser();
    showToast('Availability saved successfully!', 'success');
}

function loadRoster() {
    // Roster is now loaded via calendar, no need for separate load function
    if (document.getElementById('calendarDays')) {
        initCalendar();
    }
}

// ========== PROFILE PHOTO UPLOAD ==========
function uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Photo size should be less than 5MB', 'error');
        return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
}

function loadProfilePhoto() {
    const photo = document.getElementById('profilePhoto');
    const placeholder = document.getElementById('profilePhotoPlaceholder');
    
    if (currentUser.profilePhoto) {
        photo.src = currentUser.profilePhoto;
        photo.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        photo.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

// ========== RESUME UPLOAD WITH AI SUMMARY ==========
function uploadResume(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('Resume size should be less than 10MB', 'error');
        return;
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Please upload PDF or DOC/DOCX file', 'error');
        return;
    }
    
    showToast('Analyzing resume...', 'info');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Generate mock AI summary
        const mockSummary = generateMockResumeSummary();
        
        currentUser.resume = {
            name: file.name,
            type: file.type,
            data: e.target.result,
            uploadedAt: new Date().toISOString(),
            summary: mockSummary
        };
        updateUser();
        loadResume();
        showToast('Resume uploaded and analyzed!', 'success');
    };
    reader.readAsDataURL(file);
}

function generateMockResumeSummary() {
    const skills = ['Customer Service', 'Sales', 'Team Leadership', 'Problem Solving', 'Communication', 'Time Management'];
    const experience = Math.floor(Math.random() * 8) + 2;
    const education = ['Bachelor\'s Degree', 'Diploma', 'Certificate'][Math.floor(Math.random() * 3)];
    
    return {
        name: currentUser.name,
        experience: `${experience} years`,
        education: education,
        topSkills: skills.sort(() => 0.5 - Math.random()).slice(0, 3),
        keyHighlights: [
            `${experience}+ years of experience in customer-facing roles`,
            'Proven track record of exceeding performance targets',
            'Strong communication and interpersonal skills',
            'Experience with team management and training'
        ],
        suggestedRoles: ['Customer Service Representative', 'Sales Associate', 'Team Lead', 'Retail Manager']
    };
}

function loadResume() {
    const container = document.getElementById('resumeSection');
    
    if (!currentUser.resume) {
        container.innerHTML = '<p class="text-gray-500 mb-4">No resume uploaded</p>';
        return;
    }
    
    const uploadDate = new Date(currentUser.resume.uploadedAt).toLocaleDateString();
    const summary = currentUser.resume.summary;
    
    container.innerHTML = `
        <div class="border rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <svg class="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                    </svg>
                    <div>
                        <p class="font-semibold">${currentUser.resume.name}</p>
                        <p class="text-xs text-gray-500">Uploaded on ${uploadDate}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="downloadResume()" class="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                        Download
                    </button>
                    <button onclick="deleteResume()" class="text-red-600 hover:text-red-700 text-sm font-medium">
                        Delete
                    </button>
                </div>
            </div>
        </div>
        
        ${summary ? `
        <div class="resume-summary">
            <h4 class="font-bold text-lg mb-3 flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                AI Resume Analysis
            </h4>
            
            <div class="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-600 mb-1">Experience</p>
                    <p class="font-semibold">${summary.experience}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600 mb-1">Education</p>
                    <p class="font-semibold">${summary.education}</p>
                </div>
            </div>
            
            <div class="mb-4">
                <p class="text-sm text-gray-600 mb-2">Top Skills</p>
                <div class="flex flex-wrap gap-2">
                    ${summary.topSkills.map(skill => `<span class="badge badge-primary">${skill}</span>`).join('')}
                </div>
            </div>
            
            <div class="mb-4">
                <p class="text-sm text-gray-600 mb-2">Key Highlights</p>
                <ul class="list-disc list-inside space-y-1 text-sm">
                    ${summary.keyHighlights.map(h => `<li>${h}</li>`).join('')}
                </ul>
            </div>
            
            <div>
                <p class="text-sm text-gray-600 mb-2">Suggested Roles</p>
                <div class="flex flex-wrap gap-2">
                    ${summary.suggestedRoles.map(role => `<span class="badge badge-success">${role}</span>`).join('')}
                </div>
            </div>
        </div>
        ` : ''}
    `;
}

function downloadResume() {
    if (!currentUser.resume) return;
    
    const link = document.createElement('a');
    link.href = currentUser.resume.data;
    link.download = currentUser.resume.name;
    link.click();
}

function deleteResume() {
    if (confirm('Are you sure you want to delete your resume?')) {
        delete currentUser.resume;
        updateUser();
        loadResume();
        showToast('Resume deleted', 'success');
    }
}

// ========== GENERAL CERTIFICATES ==========
function uploadCertificate(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        showToast('Certificate size should be less than 10MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (!currentUser.certificates) currentUser.certificates = [];
        
        currentUser.certificates.push({
            id: Date.now(),
            name: file.name,
            type: file.type,
            data: e.target.result,
            uploadedAt: new Date().toISOString()
        });
        
        updateUser();
        loadCertificates();
        showToast('Certificate uploaded!', 'success');
    };
    reader.readAsDataURL(file);
}

function loadCertificates() {
    const container = document.getElementById('certificatesList');
    
    if (!currentUser.certificates || currentUser.certificates.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No certificates uploaded yet</p>';
        return;
    }
    
    container.innerHTML = currentUser.certificates.map(cert => `
        <div class="cert-card">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <svg class="w-8 h-8 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/>
                        <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                    </svg>
                    <div>
                        <p class="font-semibold text-sm">${cert.name}</p>
                        <p class="text-xs text-gray-500">${new Date(cert.uploadedAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <button onclick="deleteCertificate(${cert.id})" class="text-red-600 hover:text-red-700 text-sm">
                    Remove
                </button>
            </div>
        </div>
    `).join('');
}

function deleteCertificate(id) {
    if (confirm('Delete this certificate?')) {
        currentUser.certificates = currentUser.certificates.filter(c => c.id !== id);
        updateUser();
        loadCertificates();
        showToast('Certificate deleted', 'success');
    }
}

// ========== SKILLS WITH CERTIFICATES ==========
function addSkillFromSelect() {
    const select = document.getElementById('skillSelect');
    const skill = select.value;
    
    if (!skill) {
        showToast('Please select a skill', 'warning');
        return;
    }
    
    if (!currentUser.skills) currentUser.skills = [];
    if (!currentUser.skillCertificates) currentUser.skillCertificates = {};
    
    if (!currentUser.skills.includes(skill)) {
        currentUser.skills.push(skill);
        updateUser();
        loadSkills();
        select.value = '';
        showToast('Skill added!', 'success');
        searchJobs();
    } else {
        showToast('Skill already added', 'warning');
    }
}

function addCustomSkill() {
    const skill = document.getElementById('customSkill').value.trim().toLowerCase();
    if (!skill) return;
    
    if (!currentUser.skills) currentUser.skills = [];
    if (!currentUser.skillCertificates) currentUser.skillCertificates = {};
    
    if (!currentUser.skills.includes(skill)) {
        currentUser.skills.push(skill);
        updateUser();
        loadSkills();
        document.getElementById('customSkill').value = '';
        showToast('Custom skill added!', 'success');
        searchJobs();
    } else {
        showToast('Skill already added', 'warning');
    }
}

function removeSkill(skill) {
    currentUser.skills = currentUser.skills.filter(s => s !== skill);
    if (currentUser.skillCertificates) {
        delete currentUser.skillCertificates[skill];
    }
    updateUser();
    loadSkills();
    showToast('Skill removed', 'success');
    searchJobs();
}

function loadSkills() {
    const container = document.getElementById('skillsList');
    if (!currentUser.skills || currentUser.skills.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No skills added yet. Add skills to see matching jobs!</p>';
        return;
    }
    
    container.innerHTML = currentUser.skills.map(skill => {
        const hasCert = currentUser.skillCertificates && currentUser.skillCertificates[skill];
        
        return `
            <div class="border rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold capitalize">${skill}</span>
                    <button onclick="removeSkill('${skill}')" class="text-red-600 hover:text-red-700 text-sm">
                        Remove
                    </button>
                </div>
                ${hasCert ? `
                    <div class="flex items-center gap-2 text-sm text-green-600 mb-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        <span>Certificate uploaded</span>
                    </div>
                    <button onclick="viewSkillCertificate('${skill}')" class="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                        View Certificate
                    </button>
                ` : `
                    <button onclick="showSkillCertModal('${skill}')" class="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                        + Upload Certificate
                    </button>
                `}
            </div>
        `;
    }).join('');
}

function showSkillCertModal(skill) {
    currentSkillForCert = skill;
    document.getElementById('certSkillName').textContent = skill;
    document.getElementById('skillCertModal').classList.remove('hidden');
    document.getElementById('skillCertModal').classList.add('flex');
}

function closeSkillCertModal() {
    currentSkillForCert = null;
    document.getElementById('skillCertModal').classList.add('hidden');
    document.getElementById('skillCertModal').classList.remove('flex');
    document.getElementById('skillCertFile').value = '';
}

function uploadSkillCertificate() {
    const fileInput = document.getElementById('skillCertFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a file', 'warning');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size should be less than 10MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (!currentUser.skillCertificates) currentUser.skillCertificates = {};
        
        currentUser.skillCertificates[currentSkillForCert] = {
            name: file.name,
            type: file.type,
            data: e.target.result,
            uploadedAt: new Date().toISOString()
        };
        
        updateUser();
        loadSkills();
        closeSkillCertModal();
        showToast('Certificate uploaded!', 'success');
    };
    reader.readAsDataURL(file);
}

function viewSkillCertificate(skill) {
    if (currentUser.skillCertificates && currentUser.skillCertificates[skill]) {
        const cert = currentUser.skillCertificates[skill];
        const link = document.createElement('a');
        link.href = cert.data;
        link.download = cert.name;
        link.click();
    }
}

// ========== PORTFOLIO WITH VIDEO ==========
function showAddPortfolio() {
    document.getElementById('portfolioTitle').value = '';
    document.getElementById('portfolioDesc').value = '';
    document.getElementById('portfolioDuration').value = '';
    document.getElementById('portfolioVideo').value = '';
    document.getElementById('portfolioModal').classList.remove('hidden');
    document.getElementById('portfolioModal').classList.add('flex');
}

function closePortfolioModal() {
    document.getElementById('portfolioModal').classList.add('hidden');
    document.getElementById('portfolioModal').classList.remove('flex');
}

function savePortfolio() {
    const title = document.getElementById('portfolioTitle').value.trim();
    const desc = document.getElementById('portfolioDesc').value.trim();
    const duration = document.getElementById('portfolioDuration').value.trim();
    const videoFile = document.getElementById('portfolioVideo').files[0];
    
    if (!title || !desc) {
        showToast('Please fill in all required fields', 'warning');
        return;
    }
    
    if (videoFile && videoFile.size > 50 * 1024 * 1024) {
        showToast('Video size should be less than 50MB', 'error');
        return;
    }
    
    if (!currentUser.portfolio) currentUser.portfolio = [];
    
    if (videoFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUser.portfolio.push({
                id: Date.now(),
                title,
                description: desc,
                duration,
                video: {
                    name: videoFile.name,
                    type: videoFile.type,
                    data: e.target.result
                }
            });
            
            updateUser();
            loadPortfolio();
            closePortfolioModal();
            showToast('Portfolio item added!', 'success');
        };
        reader.readAsDataURL(videoFile);
    } else {
        currentUser.portfolio.push({
            id: Date.now(),
            title,
            description: desc,
            duration
        });
        
        updateUser();
        loadPortfolio();
        closePortfolioModal();
        showToast('Portfolio item added!', 'success');
    }
}

function loadPortfolio() {
    const container = document.getElementById('portfolioList');
    if (!currentUser.portfolio || currentUser.portfolio.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No portfolio items yet</p>';
        return;
    }
    
    container.innerHTML = currentUser.portfolio.map(item => `
        <div class="border rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold">${item.title}</h4>
                <button onclick="removePortfolio(${item.id})" class="text-red-600 hover:text-red-700 text-sm">Remove</button>
            </div>
            <p class="text-sm text-gray-600 mb-2">${item.description}</p>
            ${item.duration ? `<p class="text-xs text-gray-500 mb-2">${item.duration}</p>` : ''}
            ${item.video ? `
                <div class="mt-2">
                    <video controls class="video-preview">
                        <source src="${item.video.data}" type="${item.video.type}">
                        Your browser does not support the video tag.
                    </video>
                    <p class="text-xs text-gray-500 mt-1">${item.video.name}</p>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function removePortfolio(id) {
    currentUser.portfolio = currentUser.portfolio.filter(p => p.id !== id);
    updateUser();
    loadPortfolio();
    showToast('Portfolio item removed', 'success');
}

// Profile management
function loadProfile() {
    const info = `
        <div class="space-y-3">
            <div>
                <label class="text-sm text-gray-600">Name</label>
                <p class="font-semibold">${currentUser.name}</p>
            </div>
            <div>
                <label class="text-sm text-gray-600">Email</label>
                <p class="font-semibold">${currentUser.email}</p>
            </div>
            <div>
                <label class="text-sm text-gray-600">Phone</label>
                <p class="font-semibold">${currentUser.phone || 'Not set'}</p>
            </div>
            <div>
                <label class="text-sm text-gray-600">Rating</label>
                <div class="flex items-center">
                    ${generateStars(currentUser.rating || 0)}
                    <span class="ml-2 text-sm text-gray-600">(${currentUser.reviewCount || 0} reviews)</span>
                </div>
            </div>
            <div>
                <label class="text-sm text-gray-600">Location</label>
                <p class="font-semibold">${currentUser.location.address || 'Not set'}</p>
            </div>
        </div>
    `;
    document.getElementById('profileInfo').innerHTML = info;
}

function showEditProfile() {
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editPhone').value = currentUser.phone || '';
    document.getElementById('editEmail').value = currentUser.email;
    document.getElementById('editProfileModal').classList.remove('hidden');
    document.getElementById('editProfileModal').classList.add('flex');
}

function closeEditProfile() {
    document.getElementById('editProfileModal').classList.add('hidden');
    document.getElementById('editProfileModal').classList.remove('flex');
}

function saveProfile() {
    currentUser.name = document.getElementById('editName').value;
    currentUser.phone = document.getElementById('editPhone').value;
    updateUser();
    loadProfile();
    closeEditProfile();
    showToast('Profile updated!', 'success');
}

function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<svg class="w-5 h-5 text-yellow-400 inline" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
        } else {
            stars += '<svg class="w-5 h-5 text-gray-300 inline" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
        }
    }
    return stars;
}

function updateUser() {
    const users = JSON.parse(window.localStorage.getItem('users')) || [];
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
        users[userIndex] = currentUser;
        window.localStorage.setItem('users', JSON.stringify(users));
    }
    window.localStorage.setItem('currentUser', JSON.stringify(currentUser));
}

// Load contracts
function loadContracts() {
    const contracts = JSON.parse(window.localStorage.getItem('contracts')) || [];
    const myContracts = contracts.filter(c => c.seekerId === currentUser.id);
    
    const container = document.getElementById('contractsList');
    if (myContracts.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">No contracts yet</p>';
        return;
    }
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs')) || [];
    
    container.innerHTML = myContracts.map(contract => {
        const job = jobs.find(j => j.id === contract.jobId);
        return `
            <div class="border rounded-lg p-4">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold">${job ? job.title : 'Job'}</h4>
                        <p class="text-sm text-gray-600">Contract #${contract.id}</p>
                    </div>
                    <span class="badge ${contract.status === 'active' ? 'badge-success' : contract.status === 'completed' ? 'badge-primary' : 'badge-warning'}">
                        ${contract.status}
                    </span>
                </div>
                <div class="text-sm space-y-1 mb-3">
                    <p><strong>Start:</strong> ${new Date(contract.startDate).toLocaleDateString()}</p>
                    <p><strong>Rate:</strong> <span data-price="${contract.rate}">${formatCurrency(contract.rate)}</span>/hour</p>
                    ${contract.clockIn ? `<p><strong>Clocked In:</strong> ${new Date(contract.clockIn).toLocaleString()}</p>` : ''}
                    ${contract.clockOut ? `<p><strong>Clocked Out:</strong> ${new Date(contract.clockOut).toLocaleString()}</p>` : ''}
                </div>
                ${contract.status === 'active' && !contract.clockIn ? `
                    <button onclick="clockIn(${contract.id})" class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                        Clock In
                    </button>
                ` : ''}
                ${contract.clockIn && !contract.clockOut ? `
                    <button onclick="clockOut(${contract.id})" class="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                        Clock Out
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

function clockIn(contractId) {
    const contracts = JSON.parse(window.localStorage.getItem('contracts')) || [];
    const contract = contracts.find(c => c.id === contractId);
    if (contract) {
        contract.clockIn = new Date().toISOString();
        window.localStorage.setItem('contracts', JSON.stringify(contracts));
        showToast('Clocked in successfully!', 'success');
        loadContracts();
    }
}

function clockOut(contractId) {
    const contracts = JSON.parse(window.localStorage.getItem('contracts')) || [];
    const contract = contracts.find(c => c.id === contractId);
    if (contract) {
        contract.clockOut = new Date().toISOString();
        contract.status = 'completed';
        window.localStorage.setItem('contracts', JSON.stringify(contracts));
        showToast('Clocked out successfully!', 'success');
        loadContracts();
    }
}

// Toast notification




    function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-24 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
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