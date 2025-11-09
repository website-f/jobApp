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
        
        if (currentUser.type !== 'employer') {
            console.log('Wrong user type, redirecting to seeker dashboard');
            window.location.href = 'seeker-dashboard.html';
            return;
        }
        
        console.log('Employer authenticated:', currentUser.email);
    } catch (e) {
        console.error('Error loading user:', e);
        window.location.href = 'index.html';
    }
})();

let currentReviewId = null;
let selectedRating = 0;
let scheduleCount = 0;
let map, marker;
let selectedDates = {};
let selectedDays = {};
let locationSearchTimeout;

// Tab switching
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active', 'text-indigo-600'));
    
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) {
        btn.classList.add('tab-active', 'text-indigo-600');
    }
}

// Schedule Management for Job Posting
function addScheduleDay() {
    const container = document.getElementById('scheduleContainer');
    const id = scheduleCount++;
    
    const scheduleItem = document.createElement('div');
    scheduleItem.className = 'border rounded-lg p-4 bg-gray-50';
    scheduleItem.id = `schedule-${id}`;
    scheduleItem.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h4 class="font-medium">Working Day ${id + 1}</h4>
            <button type="button" onclick="removeScheduleDay(${id})" class="text-red-600 hover:text-red-700">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
                <label class="block text-xs font-medium mb-1">Day</label>
                <select class="schedule-day w-full px-3 py-2 border rounded text-sm" required>
                    <option value="">Select day</option>
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Date</label>
                <input type="date" class="schedule-date w-full px-3 py-2 border rounded text-sm" required>
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Time</label>
                <input type="text" class="schedule-time w-full px-3 py-2 border rounded text-sm" placeholder="09:00-17:00" required>
            </div>
        </div>
    `;
    
    container.appendChild(scheduleItem);
}

function removeScheduleDay(id) {
    const element = document.getElementById(`schedule-${id}`);
    if (element) {
        element.remove();
    }
}

// Post Job Modal
function showPostJobModal() {
    // Check subscription limits
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const myJobs = jobs.filter(j => j.employerId === currentUser.id);
    
    if (currentUser.subscription === 'free' && myJobs.length >= 3) {
        showToast('Free plan allows only 3 job posts. Upgrade to Pro for unlimited posts!', 'warning');
        showTab('subscription');
        return;
    }
    
    document.getElementById('postJobModal').classList.remove('hidden');
    document.getElementById('postJobModal').classList.add('flex');
    
    // Initialize Select2 for skills
    setTimeout(() => {
        $('#jobSkills').select2({
            placeholder: 'Select skills (you can add custom ones)',
            tags: true,
            tokenSeparators: [',']
        });
    }, 100);
    
    // Initialize Map
    setTimeout(() => {
        if (!map) {
            const lat = currentUser.location?.lat || 3.1569;
            const lng = currentUser.location?.lng || 101.7123;
            
            map = L.map('map').setView([lat, lng], 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            marker = L.marker([lat, lng], {
                draggable: true
            }).addTo(map);
            
            // Click on map to set location
            map.on('click', (e) => {
                marker.setLatLng(e.latlng);
                document.getElementById('jobLat').value = e.latlng.lat;
                document.getElementById('jobLng').value = e.latlng.lng;
            });
            
            // Drag marker
            marker.on('dragend', (e) => {
                const pos = marker.getLatLng();
                document.getElementById('jobLat').value = pos.lat;
                document.getElementById('jobLng').value = pos.lng;
            });
            
            document.getElementById('jobLat').value = lat;
            document.getElementById('jobLng').value = lng;
        } else {
            map.invalidateSize();
        }
    }, 200);
    
    // Location search functionality with autocomplete
    const locationInput = document.getElementById('jobLocation');
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.id = 'locationSuggestions';
    suggestionsDiv.className = 'absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg hidden';
    locationInput.parentElement.style.position = 'relative';
    locationInput.parentElement.appendChild(suggestionsDiv);
    
    locationInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        
        if (query.length < 3) {
            suggestionsDiv.classList.add('hidden');
            return;
        }
        
        // Debounce search
        clearTimeout(locationSearchTimeout);
        locationSearchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await response.json();
                
                if (data && data.length > 0) {
                    suggestionsDiv.innerHTML = data.map(place => `
                        <div class="location-suggestion p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0" 
                            data-lat="${place.lat}" 
                            data-lon="${place.lon}"
                            data-display="${place.display_name}">
                            <div class="font-medium text-sm">${place.display_name}</div>
                        </div>
                    `).join('');
                    suggestionsDiv.classList.remove('hidden');
                    
                    // Add click handlers to suggestions
                    document.querySelectorAll('.location-suggestion').forEach(item => {
                        item.addEventListener('click', () => {
                            const lat = parseFloat(item.dataset.lat);
                            const lon = parseFloat(item.dataset.lon);
                            const displayName = item.dataset.display;
                            
                            locationInput.value = displayName;
                            map.setView([lat, lon], 15);
                            marker.setLatLng([lat, lon]);
                            document.getElementById('jobLat').value = lat;
                            document.getElementById('jobLng').value = lon;
                            suggestionsDiv.classList.add('hidden');
                            showToast('Location selected!', 'success');
                        });
                    });
                } else {
                    suggestionsDiv.innerHTML = '<div class="p-3 text-gray-500 text-sm">No locations found</div>';
                    suggestionsDiv.classList.remove('hidden');
                }
            } catch (err) {
                console.error('Location search error:', err);
            }
        }, 300);
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!locationInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.classList.add('hidden');
        }
    });
    
    // Old Enter key search (keep as backup)
    locationInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            suggestionsDiv.classList.add('hidden');
            const query = e.target.value;
            if (query) {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        map.setView([lat, lon], 13);
                        marker.setLatLng([lat, lon]);
                        document.getElementById('jobLat').value = lat;
                        document.getElementById('jobLng').value = lon;
                        showToast('Location found!', 'success');
                    } else {
                        showToast('Location not found', 'warning');
                    }
                } catch (err) {
                    console.error('Location search error:', err);
                    showToast('Error searching location', 'warning');
                }
            }
        }
    });
    
    // Initialize Calendar
    initCalendar();
    selectedDates = {};
    selectedDays = {};
    
    // Setup day checkboxes for full-time
    document.querySelectorAll('.day-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const day = e.target.value;
            if (e.target.checked) {
                selectedDays[day] = {
                    day: day,
                    timeSlots: [{ start: '09:00', end: '17:00' }]
                };
            } else {
                delete selectedDays[day];
            }
            renderSelectedDays();
        });
    });
}

// REPLACE your existing closePostJobModal function with this:
function closePostJobModal() {
    document.getElementById('postJobModal').classList.add('hidden');
    document.getElementById('postJobModal').classList.remove('flex');
    document.getElementById('postJobForm').reset();
    
    // Destroy Select2
    if ($('#jobSkills').data('select2')) {
        $('#jobSkills').select2('destroy');
    }
    
    selectedDates = {};
    selectedDays = {};
    
    // Reset checkboxes
    document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);
}

// ADD this new function for salary label update
function updateSalaryLabel() {
    const jobType = document.getElementById('jobType').value;
    const indicator = document.getElementById('salaryIndicator');
    indicator.textContent = jobType === 'full-time' ? '- per month' : '- per hour';
    
    // Toggle schedule view based on job type
    const fullTimeSchedule = document.getElementById('fullTimeSchedule');
    const partTimeSchedule = document.getElementById('partTimeSchedule');
    
    if (jobType === 'full-time') {
        fullTimeSchedule.classList.remove('hidden');
        partTimeSchedule.classList.add('hidden');
        // Reset part-time data
        selectedDates = {};
    } else {
        fullTimeSchedule.classList.add('hidden');
        partTimeSchedule.classList.remove('hidden');
        // Reset full-time data
        selectedDays = {};
        document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('selectedDaysContainer').innerHTML = '';
        // Initialize calendar for part-time
        initCalendar();
    }
}

// ADD these new functions for calendar functionality

// For Full-time: Render selected days of week
function renderSelectedDays() {
    const container = document.getElementById('selectedDaysContainer');
    
    if (Object.keys(selectedDays).length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No days selected yet</p>';
        return;
    }
    
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const sortedDays = Object.keys(selectedDays).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    
    container.innerHTML = sortedDays.map(day => {
        const dayObj = selectedDays[day];
        
        return `
            <div class="border rounded-lg p-3 md:p-4 bg-gray-50">
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                    <h4 class="font-medium text-sm md:text-base capitalize">${day}</h4>
                </div>
                
                <div class="space-y-2" id="dayTimeSlots-${day}">
                    ${dayObj.timeSlots.map((slot, idx) => `
                        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-white rounded border">
                            <div class="flex items-center gap-2 flex-1">
                                <input type="time" value="${slot.start}" 
                                    onchange="updateDayTimeSlot('${day}', ${idx}, 'start', this.value)" 
                                    class="flex-1 border rounded px-2 py-1.5 text-sm">
                                <span class="text-sm text-gray-600">to</span>
                                <input type="time" value="${slot.end}" 
                                    onchange="updateDayTimeSlot('${day}', ${idx}, 'end', this.value)" 
                                    class="flex-1 border rounded px-2 py-1.5 text-sm">
                            </div>
                            <button type="button" onclick="removeDayTimeSlot('${day}', ${idx})" 
                                class="self-end sm:self-auto text-red-600 hover:text-red-700 p-1">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <button type="button" onclick="addDayTimeSlot('${day}')" 
                    class="mt-2 w-full py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs md:text-sm font-medium">
                    + Add Time Slot
                </button>
            </div>
        `;
    }).join('');
}

function addDayTimeSlot(day) {
    if (!selectedDays[day].timeSlots) {
        selectedDays[day].timeSlots = [];
    }
    selectedDays[day].timeSlots.push({ start: '09:00', end: '17:00' });
    renderSelectedDays();
}

function removeDayTimeSlot(day, index) {
    selectedDays[day].timeSlots.splice(index, 1);
    if (selectedDays[day].timeSlots.length === 0) {
        selectedDays[day].timeSlots.push({ start: '09:00', end: '17:00' });
    }
    renderSelectedDays();
}

function updateDayTimeSlot(day, index, field, value) {
    selectedDays[day].timeSlots[index][field] = value;
}

// For Part-time: Calendar functions
function initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    document.getElementById('calendarMonth').textContent = 
        new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
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
    const today = now.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day text-xs sm:text-sm';
        dayDiv.textContent = day;
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (day < today) {
            dayDiv.classList.add('past', 'disabled');
        } else {
            dayDiv.onclick = () => toggleDate(dateStr, dayDiv);
        }
        
        calendarDays.appendChild(dayDiv);
    }
}

function toggleDate(dateStr, element) {
    if (selectedDates[dateStr]) {
        delete selectedDates[dateStr];
        element.classList.remove('selected');
    } else {
        selectedDates[dateStr] = { 
            date: dateStr, 
            timeSlots: [{ start: '09:00', end: '17:00' }] 
        };
        element.classList.add('selected');
    }
    renderSelectedDates();
}

function renderSelectedDates() {
    const container = document.getElementById('selectedDatesContainer');
    
    if (Object.keys(selectedDates).length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No dates selected yet</p>';
        return;
    }
    
    container.innerHTML = Object.keys(selectedDates).sort().map(dateStr => {
        const dateObj = selectedDates[dateStr];
        const date = new Date(dateStr + 'T00:00:00');
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        return `
            <div class="border rounded-lg p-3 md:p-4 bg-gray-50">
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                    <div>
                        <h4 class="font-medium text-sm md:text-base">${dayName}</h4>
                        <p class="text-xs md:text-sm text-gray-600">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <button type="button" onclick="removeDate('${dateStr}')" class="self-end sm:self-auto text-red-600 hover:text-red-700">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div class="space-y-2" id="timeSlots-${dateStr}">
                    ${dateObj.timeSlots.map((slot, idx) => `
                        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-white rounded border">
                            <div class="flex items-center gap-2 flex-1">
                                <input type="time" value="${slot.start}" 
                                    onchange="updateTimeSlot('${dateStr}', ${idx}, 'start', this.value)" 
                                    class="flex-1 border rounded px-2 py-1.5 text-sm">
                                <span class="text-sm text-gray-600">to</span>
                                <input type="time" value="${slot.end}" 
                                    onchange="updateTimeSlot('${dateStr}', ${idx}, 'end', this.value)" 
                                    class="flex-1 border rounded px-2 py-1.5 text-sm">
                            </div>
                            <button type="button" onclick="removeTimeSlot('${dateStr}', ${idx})" 
                                class="self-end sm:self-auto text-red-600 hover:text-red-700 p-1">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <button type="button" onclick="addTimeSlot('${dateStr}')" 
                    class="mt-2 w-full py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs md:text-sm font-medium">
                    + Add Time Slot
                </button>
            </div>
        `;
    }).join('');
}

function removeDate(dateStr) {
    delete selectedDates[dateStr];
    const date = new Date(dateStr + 'T00:00:00');
    const dayNum = date.getDate();
    
    const dayElements = document.querySelectorAll('.calendar-day.selected');
    dayElements.forEach(el => {
        if (el.textContent == dayNum) {
            el.classList.remove('selected');
        }
    });
    renderSelectedDates();
}

function addTimeSlot(dateStr) {
    if (!selectedDates[dateStr].timeSlots) {
        selectedDates[dateStr].timeSlots = [];
    }
    selectedDates[dateStr].timeSlots.push({ start: '09:00', end: '17:00' });
    renderSelectedDates();
}

function removeTimeSlot(dateStr, index) {
    selectedDates[dateStr].timeSlots.splice(index, 1);
    if (selectedDates[dateStr].timeSlots.length === 0) {
        // Keep at least one time slot or remove the date
        selectedDates[dateStr].timeSlots.push({ start: '09:00', end: '17:00' });
    }
    renderSelectedDates();
}

function updateTimeSlot(dateStr, index, field, value) {
    selectedDates[dateStr].timeSlots[index][field] = value;
}

function handlePostJob(event) {
    event.preventDefault();
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const skills = $('#jobSkills').val();
    const jobType = document.getElementById('jobType').value;
    
    // Validate skills
    if (!skills || skills.length === 0) {
        showToast('Please select at least one skill', 'warning');
        return;
    }
    
    // Validate location
    const lat = document.getElementById('jobLat').value;
    const lng = document.getElementById('jobLng').value;
    
    if (!lat || !lng) {
        showToast('Please set a location on the map', 'warning');
        return;
    }
    
    // Collect and validate schedule data based on job type
    let scheduleDays = [];
    
    if (jobType === 'full-time') {
        // For full-time: use selected days of week
        for (const day in selectedDays) {
            const dayData = selectedDays[day];
            if (!dayData.timeSlots || dayData.timeSlots.length === 0) {
                showToast(`Please add at least one time slot for ${day}`, 'warning');
                return;
            }
            
            scheduleDays.push({
                day: day,
                date: null, // No specific date for full-time
                timeSlots: dayData.timeSlots
            });
        }
        
        if (scheduleDays.length === 0) {
            showToast('Please select at least one working day', 'warning');
            return;
        }
    } else {
        // For part-time: use selected specific dates
        for (const dateStr in selectedDates) {
            const dateData = selectedDates[dateStr];
            if (!dateData.timeSlots || dateData.timeSlots.length === 0) {
                showToast(`Please add at least one time slot for ${dateStr}`, 'warning');
                return;
            }
            
            const date = new Date(dateStr + 'T00:00:00');
            scheduleDays.push({
                day: date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
                date: dateStr,
                timeSlots: dateData.timeSlots
            });
        }
        
        if (scheduleDays.length === 0) {
            showToast('Please select at least one working date from the calendar', 'warning');
            return;
        }
    }
    
    const newJob = {
        id: Date.now(),
        title: document.getElementById('jobTitle').value,
        company: document.getElementById('jobCompany').value,
        type: jobType,
        salary: parseFloat(document.getElementById('jobSalary').value),
        location: document.getElementById('jobLocation').value,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        description: document.getElementById('jobDescription').value,
        skills: skills,
        schedule: {
            type: jobType === 'full-time' ? 'recurring' : 'specific',
            days: scheduleDays
        },
        posted: new Date().toISOString(),
        employerId: currentUser.id
    };
    
    jobs.push(newJob);
    window.localStorage.setItem('jobs', JSON.stringify(jobs));
    
    showToast('Job posted successfully!', 'success');
    closePostJobModal();
    loadMyJobs();
}
// Load employer's jobs
function loadMyJobs() {
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const myJobs = jobs.filter(j => j.employerId === currentUser.id);
    
    const container = document.getElementById('myJobsList');
    if (myJobs.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-500">No jobs posted yet</div>';
        return;
    }
    
    container.innerHTML = myJobs.map(job => {
        // Better schedule display
        let scheduleDisplay = 'Not specified';
        if (job.schedule && job.schedule.days && Array.isArray(job.schedule.days)) {
            if (job.schedule.type === 'recurring') {
                // Full-time: Show days of week
                scheduleDisplay = job.schedule.days.map(d => {
                    const timeSlots = d.timeSlots ? 
                        d.timeSlots.map(t => `${t.start}-${t.end}`).join(', ') : 
                        '';
                    return `<div class="mb-1"><strong>${d.day.charAt(0).toUpperCase() + d.day.slice(1)}:</strong><br><span class="text-xs text-gray-500">${timeSlots}</span></div>`;
                }).join('');
            } else {
                // Part-time: Show specific dates
                scheduleDisplay = job.schedule.days.map(d => {
                    const timeSlots = d.timeSlots ? 
                        d.timeSlots.map(t => `${t.start}-${t.end}`).join(', ') : 
                        '';
                    return `<div class="mb-1"><strong>${d.day.charAt(0).toUpperCase() + d.day.slice(1)}:</strong> ${d.date}<br><span class="text-xs text-gray-500">${timeSlots}</span></div>`;
                }).join('');
            }
        }
        
        return `
        <div class="bg-white rounded-xl shadow-lg p-6">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="text-xl font-bold">${job.title}</h3>
                    <p class="text-gray-600">${job.company}</p>
                </div>
                <div class="flex gap-2">
                    <span class="badge ${job.type === 'full-time' ? 'badge-primary' : 'badge-success'}">${job.type}</span>
                    <button onclick="deleteJob(${job.id})" class="text-red-600 hover:text-red-700">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-3">${job.description}</p>
            <div class="flex items-center text-gray-600 text-sm mb-2">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span>${job.location}</span>
            </div>
            <div class="flex items-center text-gray-600 text-sm mb-2">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                </svg>
                <span data-price="${job.salary}">${formatCurrency(job.salary)}</span>
                ${job.type === 'part-time' ? '/hour' : '/month'}
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
                ${job.skills.map(skill => `<span class="badge badge-primary">${skill}</span>`).join('')}
            </div>
            <div class="bg-gray-50 rounded-lg p-3 mb-3">
                <p class="text-xs font-medium text-gray-700 mb-1">Working Schedule ${job.schedule.type === 'recurring' ? '(Recurring)' : '(Specific Dates)'}:</p>
                <div class="text-xs text-gray-600">${scheduleDisplay}</div>
            </div>
            <p class="text-xs text-gray-500">Posted ${new Date(job.posted).toLocaleDateString()}</p>
        </div>
    `;
    }).join('');
}

function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) return;
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const filtered = jobs.filter(j => j.id !== jobId);
    window.localStorage.setItem('jobs', JSON.stringify(filtered));
    
    showToast('Job deleted', 'success');
    loadMyJobs();
}

// Load applications
function loadApplications() {
    const applications = JSON.parse(window.localStorage.getItem('applications'));
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const users = JSON.parse(window.localStorage.getItem('users'));
    
    const myJobs = jobs.filter(j => j.employerId === currentUser.id);
    const myJobIds = myJobs.map(j => j.id);
    
    const myApplications = applications.filter(app => myJobIds.includes(app.jobId));
    
    const container = document.getElementById('applicationsList');
    if (myApplications.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">No applications yet</p>';
        return;
    }
    
    container.innerHTML = myApplications.map(app => {
        const job = jobs.find(j => j.id === app.jobId);
        const seeker = users.find(u => u.id === app.seekerId);
        
        return `
            <div class="bg-white rounded-lg p-4 border">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold">${seeker.name}</h4>
                        <p class="text-sm text-gray-600">${job.title}</p>
                    </div>
                    <span class="badge ${app.status === 'pending' ? 'badge-warning' : app.status === 'accepted' ? 'badge-success' : 'badge-danger'}">
                        ${app.status}
                    </span>
                </div>
                <div class="flex items-center text-sm text-gray-600 mb-3">
                    <div class="flex items-center mr-4">
                        ${generateStars(seeker.rating)}
                        <span class="ml-1">(${seeker.reviewCount})</span>
                    </div>
                </div>
                <div class="mb-3">
                    <p class="text-sm font-medium mb-1">Skills:</p>
                    <div class="flex flex-wrap gap-1">
                        ${seeker.skills.map(skill => `<span class="badge badge-primary text-xs">${skill}</span>`).join('')}
                    </div>
                </div>
                <p class="text-xs text-gray-500 mb-3">Applied ${new Date(app.appliedAt).toLocaleDateString()}</p>
                ${app.status === 'pending' ? `
                    <div class="flex gap-2">
                        <button onclick="acceptApplication(${app.id})" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                            Accept
                        </button>
                        <button onclick="rejectApplication(${app.id})" class="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                            Reject
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function acceptApplication(appId) {
    const applications = JSON.parse(window.localStorage.getItem('applications'));
    const app = applications.find(a => a.id === appId);
    app.status = 'accepted';
    window.localStorage.setItem('applications', JSON.stringify(applications));
    
    // Update seeker's availability
    updateSeekerAvailability(app.seekerId, app.jobId);
    
    // Create contract
    const contracts = JSON.parse(window.localStorage.getItem('contracts'));
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const job = jobs.find(j => j.id === app.jobId);
    
    contracts.push({
        id: Date.now(),
        jobId: app.jobId,
        seekerId: app.seekerId,
        employerId: currentUser.id,
        status: 'active',
        startDate: new Date().toISOString(),
        rate: job.salary,
        clockIn: null,
        clockOut: null,
        reviewed: false
    });
    window.localStorage.setItem('contracts', JSON.stringify(contracts));
    
    // Notify seeker
    addNotification(app.seekerId, `Your application for ${job.title} has been accepted!`, 'success');
    
    showToast('Application accepted and contract created!', 'success');
    loadApplications();
    loadContracts();
}

function rejectApplication(appId) {
    const applications = JSON.parse(window.localStorage.getItem('applications'));
    const app = applications.find(a => a.id === appId);
    app.status = 'rejected';
    window.localStorage.setItem('applications', JSON.stringify(applications));
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const job = jobs.find(j => j.id === app.jobId);
    addNotification(app.seekerId, `Your application for ${job.title} was not accepted this time.`, 'info');
    
    showToast('Application rejected', 'success');
    loadApplications();
}

// Update seeker availability when application is accepted
function updateSeekerAvailability(seekerId, jobId) {
    const users = JSON.parse(window.localStorage.getItem('users'));
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const seeker = users.find(u => u.id === seekerId);
    const job = jobs.find(j => j.id === jobId);
    
    if (!seeker || !job || !seeker.availability) return;
    
    // Mark schedule days as unavailable
    if (job.schedule && job.schedule.days && Array.isArray(job.schedule.days)) {
        job.schedule.days.forEach(scheduleDay => {
            const availDay = seeker.availability.find(a => 
                a.day.toLowerCase() === scheduleDay.day.toLowerCase()
            );
            
            if (availDay) {
                availDay.available = false;
                availDay.bookedFor = jobId;
            }
        });
        
        window.localStorage.setItem('users', JSON.stringify(users));
    }
}

// Load bids
function loadBids() {
    const bids = JSON.parse(window.localStorage.getItem('bids'));
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const users = JSON.parse(window.localStorage.getItem('users'));
    
    const myJobs = jobs.filter(j => j.employerId === currentUser.id);
    const myJobIds = myJobs.map(j => j.id);
    
    const myBids = bids.filter(bid => myJobIds.includes(bid.jobId));
    
    const container = document.getElementById('bidsList');
    if (myBids.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">No bids yet</p>';
        return;
    }
    
    container.innerHTML = myBids.map(bid => {
        const job = jobs.find(j => j.id === bid.jobId);
        const seeker = users.find(u => u.id === bid.seekerId);
        
        return `
            <div class="bg-white rounded-lg p-4 border">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold">${seeker.name}</h4>
                        <p class="text-sm text-gray-600">${job.title}</p>
                    </div>
                    <span class="badge ${bid.status === 'pending' ? 'badge-warning' : bid.status === 'accepted' ? 'badge-success' : 'badge-danger'}">
                        ${bid.status}
                    </span>
                </div>
                <div class="flex items-center text-sm text-gray-600 mb-3">
                    ${generateStars(seeker.rating)}
                    <span class="ml-1">(${seeker.reviewCount})</span>
                </div>
                <p class="text-lg font-bold text-indigo-600 mb-2">
                    Bid: <span data-price="${bid.amount}">${formatCurrency(bid.amount)}</span> ${job.type === 'part-time' ? '/hour' : '/month'}
                </p>
                ${bid.message ? `<p class="text-sm text-gray-600 mb-3">"${bid.message}"</p>` : ''}
                <p class="text-xs text-gray-500 mb-3">Submitted ${new Date(bid.createdAt).toLocaleDateString()}</p>
                ${bid.status === 'pending' ? `
                    <div class="flex gap-2">
                        <button onclick="acceptBid(${bid.id})" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                            Accept Bid
                        </button>
                        <button onclick="rejectBid(${bid.id})" class="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                            Reject
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function acceptBid(bidId) {
    const bids = JSON.parse(window.localStorage.getItem('bids'));
    const bid = bids.find(b => b.id === bidId);
    bid.status = 'accepted';
    window.localStorage.setItem('bids', JSON.stringify(bids));
    
    // Update seeker's availability
    updateSeekerAvailability(bid.seekerId, bid.jobId);
    
    // Create contract with bid amount
    const contracts = JSON.parse(window.localStorage.getItem('contracts'));
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const job = jobs.find(j => j.id === bid.jobId);
    
    contracts.push({
        id: Date.now(),
        jobId: bid.jobId,
        seekerId: bid.seekerId,
        employerId: currentUser.id,
        status: 'active',
        startDate: new Date().toISOString(),
        rate: bid.amount,
        clockIn: null,
        clockOut: null,
        reviewed: false
    });
    window.localStorage.setItem('contracts', JSON.stringify(contracts));
    
    addNotification(bid.seekerId, `Your bid for ${job.title} has been accepted!`, 'success');
    
    showToast('Bid accepted and contract created!', 'success');
    loadBids();
    loadContracts();
}

function rejectBid(bidId) {
    const bids = JSON.parse(window.localStorage.getItem('bids'));
    const bid = bids.find(b => b.id === bidId);
    bid.status = 'rejected';
    window.localStorage.setItem('bids', JSON.stringify(bids));
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const job = jobs.find(j => j.id === bid.jobId);
    addNotification(bid.seekerId, `Your bid for ${job.title} was not accepted.`, 'info');
    
    showToast('Bid rejected', 'success');
    loadBids();
}

// Load contracts
function loadContracts() {
    const contracts = JSON.parse(window.localStorage.getItem('contracts'));
    const myContracts = contracts.filter(c => c.employerId === currentUser.id);
    
    const container = document.getElementById('contractsList');
    if (myContracts.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">No contracts yet</p>';
        return;
    }
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const users = JSON.parse(window.localStorage.getItem('users'));
    
    container.innerHTML = myContracts.map(contract => {
        const job = jobs.find(j => j.id === contract.jobId);
        const seeker = users.find(u => u.id === contract.seekerId);
        
        return `
            <div class="bg-white rounded-lg p-4 border">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold">${job ? job.title : 'Job'}</h4>
                        <p class="text-sm text-gray-600">${seeker.name}</p>
                    </div>
                    <span class="badge ${contract.status === 'active' ? 'badge-success' : contract.status === 'completed' ? 'badge-primary' : 'badge-warning'}">
                        ${contract.status}
                    </span>
                </div>
                <div class="text-sm space-y-1 mb-3">
                    <p><strong>Contract ID:</strong> #${contract.id}</p>
                    <p><strong>Start Date:</strong> ${new Date(contract.startDate).toLocaleDateString()}</p>
                    <p><strong>Rate:</strong> <span data-price="${contract.rate}">${formatCurrency(contract.rate)}</span>/hour</p>
                    ${contract.clockIn ? `<p><strong>Clocked In:</strong> ${new Date(contract.clockIn).toLocaleString()}</p>` : ''}
                    ${contract.clockOut ? `<p><strong>Clocked Out:</strong> ${new Date(contract.clockOut).toLocaleString()}</p>` : ''}
                    ${contract.clockIn && contract.clockOut ? `
                        <p><strong>Hours Worked:</strong> ${calculateHours(contract.clockIn, contract.clockOut)} hours</p>
                        <p class="text-lg font-bold text-indigo-600">
                            <strong>Total:</strong> <span data-price="${calculateTotal(contract)}">
                                ${formatCurrency(calculateTotal(contract))}
                            </span>
                        </p>
                    ` : ''}
                </div>
                ${contract.status === 'completed' && !contract.reviewed ? `
                    <button onclick="showReviewModal(${contract.id}, '${contract.seekerId}')" class="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
                        Leave Review
                    </button>
                ` : ''}
                ${contract.status === 'active' ? `
                    <button onclick="downloadContract(${contract.id})" class="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700">
                        Download Contract
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

function calculateHours(clockIn, clockOut) {
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const diff = (end - start) / (1000 * 60 * 60);
    return diff.toFixed(2);
}

function calculateTotal(contract) {
    if (!contract.clockIn || !contract.clockOut) return 0;
    const hours = calculateHours(contract.clockIn, contract.clockOut);
    return (parseFloat(hours) * contract.rate).toFixed(2);
}

function downloadContract(contractId) {
    const contracts = JSON.parse(window.localStorage.getItem('contracts'));
    const contract = contracts.find(c => c.id === contractId);
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const users = JSON.parse(window.localStorage.getItem('users'));
    const job = jobs.find(j => j.id === contract.jobId);
    const seeker = users.find(u => u.id === contract.seekerId);
    
    const contractText = `
JOB CONTRACT AGREEMENT

Contract ID: #${contract.id}
Date: ${new Date().toLocaleDateString()}

EMPLOYER: ${currentUser.name}
EMPLOYEE: ${seeker.name}

JOB DETAILS:
Position: ${job.title}
Company: ${job.company}
Rate: ${formatCurrency(contract.rate)}/hour
Start Date: ${new Date(contract.startDate).toLocaleDateString()}

${contract.clockIn ? `Clock In: ${new Date(contract.clockIn).toLocaleString()}` : ''}
${contract.clockOut ? `Clock Out: ${new Date(contract.clockOut).toLocaleString()}` : ''}
${contract.clockIn && contract.clockOut ? `Hours Worked: ${calculateHours(contract.clockIn, contract.clockOut)}` : ''}
${contract.clockIn && contract.clockOut ? `Total Payment: ${formatCurrency(calculateTotal(contract))}` : ''}

This contract is generated by JobMatch platform.
    `.trim();
    
    const blob = new Blob([contractText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${contract.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Contract downloaded!', 'success');
}

// Review system
function showReviewModal(contractId, seekerId) {
    currentReviewId = contractId;
    selectedRating = 0;
    document.querySelectorAll('.star-btn').forEach(btn => btn.classList.remove('text-yellow-400'));
    document.getElementById('reviewText').value = '';
    document.getElementById('reviewModal').classList.remove('hidden');
    document.getElementById('reviewModal').classList.add('flex');
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.add('hidden');
    document.getElementById('reviewModal').classList.remove('flex');
}

function setRating(rating) {
    selectedRating = rating;
    document.querySelectorAll('.star-btn').forEach((btn, index) => {
        if (index < rating) {
            btn.classList.add('text-yellow-400');
        } else {
            btn.classList.remove('text-yellow-400');
        }
    });
}

function submitReview() {
    if (selectedRating === 0) {
        showToast('Please select a rating', 'warning');
        return;
    }
    
    const text = document.getElementById('reviewText').value;
    const contracts = JSON.parse(window.localStorage.getItem('contracts'));
    const contract = contracts.find(c => c.id === currentReviewId);
    
    // Mark contract as reviewed
    contract.reviewed = true;
    window.localStorage.setItem('contracts', JSON.stringify(contracts));
    
    // Save review
    const reviews = JSON.parse(window.localStorage.getItem('reviews'));
    reviews.push({
        id: Date.now(),
        contractId: currentReviewId,
        fromUserId: currentUser.id,
        toUserId: contract.seekerId,
        rating: selectedRating,
        text: text,
        createdAt: new Date().toISOString()
    });
    window.localStorage.setItem('reviews', JSON.stringify(reviews));
    
    // Update seeker's rating
    const users = JSON.parse(window.localStorage.getItem('users'));
    const seeker = users.find(u => u.id === contract.seekerId);
    const seekerReviews = reviews.filter(r => r.toUserId === seeker.id);
    const avgRating = seekerReviews.reduce((sum, r) => sum + r.rating, 0) / seekerReviews.length;
    seeker.rating = Math.round(avgRating * 10) / 10;
    seeker.reviewCount = seekerReviews.length;
    window.localStorage.setItem('users', JSON.stringify(users));
    
    addNotification(contract.seekerId, `${currentUser.name} left you a ${selectedRating}-star review!`, 'info');
    
    showToast('Review submitted!', 'success');
    closeReviewModal();
    loadContracts();
}

// Subscription Management
function subscribe(plan) {
    const prices = {
        'free': 0,
        'pro': 99,
        'enterprise': 299
    };
    
    if (plan !== 'free') {
        if (!confirm(`Confirm subscription to ${plan.toUpperCase()} plan for ${formatCurrency(prices[plan])}/month?`)) {
            return;
        }
    }
    
    currentUser.subscription = plan;
    const users = JSON.parse(window.localStorage.getItem('users'));
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    users[userIndex] = currentUser;
    window.localStorage.setItem('users', JSON.stringify(users));
    window.localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    document.getElementById('currentPlan').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    showToast(`Successfully subscribed to ${plan.toUpperCase()} plan!`, 'success');
    
    // Track revenue
    if (plan !== 'free') {
        trackRevenue('subscription', plan, prices[plan]);
    }
}

// Advertisement Purchase
function purchaseAdvertising(type, price) {
    if (!confirm(`Confirm purchase of ${type} advertising for ${formatCurrency(price)}?`)) {
        return;
    }
    
    // Initialize advertisements if not exists
    let advertisements = JSON.parse(window.localStorage.getItem('advertisements') || '[]');
    
    advertisements.push({
        id: Date.now(),
        employerId: currentUser.id,
        type: type,
        price: price,
        purchaseDate: new Date().toISOString(),
        status: 'active',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });
    
    window.localStorage.setItem('advertisements', JSON.stringify(advertisements));
    
    showToast(`${type} advertising purchased successfully!`, 'success');
    
    // Track revenue
    trackRevenue('advertising', type, price);
}

// Revenue Tracking
function trackRevenue(type, category, amount) {
    let revenue = JSON.parse(window.localStorage.getItem('revenue') || '[]');
    
    revenue.push({
        id: Date.now(),
        type: type,
        category: category,
        amount: amount,
        userId: currentUser.id,
        date: new Date().toISOString()
    });
    
    window.localStorage.setItem('revenue', JSON.stringify(revenue));
}

// Utility functions
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<svg class="w-4 h-4 text-yellow-400 inline" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
        } else {
            stars += '<svg class="w-4 h-4 text-gray-300 inline" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
        }
    }
    return stars;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMyJobs();
    loadApplications();
    loadBids();
    loadContracts();
    document.getElementById('currentPlan').textContent = 
        currentUser.subscription.charAt(0).toUpperCase() + currentUser.subscription.slice(1);
});