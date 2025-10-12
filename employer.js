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

// Post Job Modal
function showPostJobModal() {
    document.getElementById('postJobModal').classList.remove('hidden');
    document.getElementById('postJobModal').classList.add('flex');
}

function closePostJobModal() {
    document.getElementById('postJobModal').classList.add('hidden');
    document.getElementById('postJobModal').classList.remove('flex');
    document.getElementById('postJobForm').reset();
}

function handlePostJob(event) {
    event.preventDefault();
    
    const jobs = JSON.parse(window.localStorage.getItem('jobs'));
    const skills = document.getElementById('jobSkills').value.split(',').map(s => s.trim()).filter(s => s);
    const days = document.getElementById('jobDays').value.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
    
    const newJob = {
        id: Date.now(),
        title: document.getElementById('jobTitle').value,
        company: document.getElementById('jobCompany').value,
        type: document.getElementById('jobType').value,
        salary: parseFloat(document.getElementById('jobSalary').value),
        location: document.getElementById('jobLocation').value,
        lat: currentUser.location.lat,
        lng: currentUser.location.lng,
        description: document.getElementById('jobDescription').value,
        skills: skills,
        schedule: {
            type: 'weekly',
            days: days,
            times: document.getElementById('jobTimes').value
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
    
    container.innerHTML = myJobs.map(job => `
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
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                </svg>
                <span data-price="${job.salary}">${formatCurrency(job.salary)}</span>
                ${job.type === 'part-time' ? '/hour' : '/month'}
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
                ${job.skills.map(skill => `<span class="badge badge-primary">${skill}</span>`).join('')}
            </div>
            <p class="text-xs text-gray-500">Posted ${new Date(job.posted).toLocaleDateString()}</p>
        </div>
    `).join('');
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

// Subscription
function subscribe(plan) {
    currentUser.subscription = plan;
    const users = JSON.parse(window.localStorage.getItem('users'));
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    users[userIndex] = currentUser;
    window.localStorage.setItem('users', JSON.stringify(users));
    window.localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    document.getElementById('currentPlan').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    showToast(`Subscribed to ${plan} plan!`, 'success');
}

function contactAdvertising() {
    showToast('Thank you for your interest! Our team will contact you soon.', 'success');
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