const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxn5Fo69884yHByJAq1n7cPslpIbume1D0PNKXxP9wcXL3WYsxQy04uBhiUKTDBMoMF/exec"; 

const app = {
    data: null,
    
    async init() {
        const path = window.location.pathname;
        const token = localStorage.getItem('token');

        if (path.includes('admin.html') && token) {
            window.location.href = 'dashboard.html';
            return;
        }
        if (path.includes('dashboard.html') && !token) {
            window.location.href = 'admin.html';
            return;
        }

        this.toggleLoader(true);
        await this.fetchData();
        this.toggleLoader(false);

        // Initialize AOS animations after data is fetched and rendered
        if(typeof AOS !== 'undefined') {
            setTimeout(() => { AOS.init({ duration: 800, once: true }); }, 100);
        }
    },

    toggleLoader(show, text = "Loading...") {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.toggle('hidden', !show);
            const loaderText = document.getElementById('loader-text');
            if(loaderText) loaderText.innerText = text;
        }
    },

    async fetchData() {
        try {
            const res = await fetch(APPS_SCRIPT_URL);
            const json = await res.json();
            this.data = json.data;
            this.renderPublic();
        } catch(e) { console.error(e); alert("Connection Error"); }
    },

    async post(payload) {
        this.toggleLoader(true, "Saving...");
        try {
            const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
            return await res.json();
        } catch(e) { return {status: 'error'}; }
        finally { this.toggleLoader(false); }
    },

    async handleUpload(input, targetId) {
        const file = input.files[0];
        if(!file) return;
        
        this.toggleLoader(true, "Uploading Image...");
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64 = e.target.result.split(',')[1]; 
            const payload = {
                action: 'upload',
                fileName: file.name,
                mimeType: file.type,
                fileData: base64
            };
            
            try {
                const res = await fetch(APPS_SCRIPT_URL, { 
                    method: 'POST', 
                    body: JSON.stringify(payload) 
                });
                const json = await res.json();
                
                if(json.status === 'success') {
                    document.getElementById(targetId).value = json.url; 
                    alert("Upload Success!");
                } else {
                    alert("Upload Failed: " + json.message);
                }
            } catch(err) {
                console.error(err);
                alert("Upload Error");
            } finally {
                app.toggleLoader(false);
            }
        };
        reader.readAsDataURL(file);
    },

    renderPublic() {
        if (!this.data) return;
        const { profile, education, activities } = this.data;
        const has = (val) => val && val.length > 1;

        // --- Index Page ---
        if (document.getElementById('home-hero')) {
            document.getElementById('home-hero').innerHTML = `
                <img src="${profile.image || 'https://via.placeholder.com/150'}" class="w-40 h-auto mx-auto rounded-lg border-4 border-white shadow-lg mb-4 object-contain bg-white">
                <h1 class="text-4xl font-bold text-gray-800 mb-2">${profile.name || 'Your Name'}</h1>
                <p class="text-lg text-gray-600 max-w-2xl mx-auto mb-6">${profile.bio || 'No Bio'}</p>
                <div class="flex justify-center gap-4 flex-wrap">
                    ${has(profile.email) ? `<a href="mailto:${profile.email}" class="blob-btn bg-mail-blob"><i class="fas fa-envelope"></i></a>` : ''}
                    ${has(profile.phone) ? `<a href="tel:${profile.phone}" class="blob-btn bg-phone-blob"><i class="fas fa-phone"></i></a>` : ''}
                    ${has(profile.facebook) ? `<a href="${profile.facebook}" target="_blank" class="blob-btn bg-fb-blob"><i class="fab fa-facebook-f"></i></a>` : ''}
                    ${has(profile.instagram) ? `<a href="${profile.instagram}" target="_blank" class="blob-btn bg-ig-blob"><i class="fab fa-instagram"></i></a>` : ''}
                    ${has(profile.line) ? `<a href="${profile.line}" target="_blank" class="blob-btn bg-line-blob"><i class="fab fa-line"></i></a>` : ''}
                </div>
            `;
            this.renderEdu([...education].reverse().slice(0, 3), 'home-education-list');
            const randomActivities = [...activities].sort(() => 0.5 - Math.random()).slice(0, 3);
            this.renderActList(randomActivities, 'home-activity-list');
        }

        // --- Education Page ---
        if (document.getElementById('full-education-list')) {
            this.renderEdu([...education].reverse(), 'full-education-list');
        }

        // --- Activity Page ---
        if (document.getElementById('activity-filters') && document.getElementById('full-activity-list')) {
            this.renderActivityFilters();
            this.filterActivities('all');
        }

        // --- Dashboard Page ---
        if (document.getElementById('dash-profile')) {
            this.renderDashboard();
        }
    },

    renderEdu(list, targetId) {
        const container = document.getElementById(targetId);
        if(!container) return;
        container.innerHTML = list.map((e, index) => `
            <div data-aos="fade-up" data-aos-delay="${index * 100}" onclick='app.openEduModal(${JSON.stringify(e).replace(/'/g, "&#39;")})' class="cursor-pointer bg-white p-4 rounded shadow-sm border-l-4 border-p-med flex justify-between items-center hover:shadow-md transition transform hover:-translate-y-1">
                <div class="flex items-center gap-4">
                    ${e.LogoURL 
                        ? `<img src="${e.LogoURL}" class="w-16 h-16 object-contain bg-white border border-gray-100 rounded p-1">` 
                        : '<div class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">No Logo</div>'
                    }
                    <div>
                        <div class="font-bold text-lg text-gray-800">${e.School}</div>
                        <div class="text-sm text-gray-500">${e.Year} | ${e.Level}</div>
                    </div>
                </div>
                <div class="bg-p-light text-p-dark px-3 py-1 rounded font-bold whitespace-nowrap">${e.GPA}</div>
            </div>
        `).join('');
    },

    // --- Dynamic Categories Logic ---
    renderActivityFilters() {
        const allActs = [...this.data.activities];
        // Extract unique categories, ignoring empty ones
        const categories = [...new Set(allActs.map(a => a.Category))].filter(c => c && c.trim() !== '');
        
        const filterContainer = document.getElementById('activity-filters');
        if (filterContainer) {
            let html = `<button onclick="app.filterActivities('all', this)" class="filter-btn active">ทั้งหมด</button>`;
            categories.forEach(cat => {
                html += `<button onclick="app.filterActivities('${cat}', this)" class="filter-btn">${cat}</button>`;
            });
            filterContainer.innerHTML = html;
        }

        // Also update the dropdown options in the Admin Dashboard if it exists
        const catSelect = document.getElementById('act-cat');
        if (catSelect) {
            let selectHtml = '';
            categories.forEach(cat => {
                selectHtml += `<option value="${cat}">${cat}</option>`;
            });
            selectHtml += `<option value="อื่นๆ">อื่นๆ (ระบุเอง)</option>`;
            catSelect.innerHTML = selectHtml;
        }
    },

    filterActivities(category, btnElement) {
        const allActs = [...this.data.activities].reverse();
        let filtered = allActs;

        if(btnElement) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btnElement.classList.add('active');
        } else {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const firstBtn = document.querySelector('.filter-btn:first-child');
            if(firstBtn) firstBtn.classList.add('active');
        }

        if(category !== 'all') {
            filtered = allActs.filter(a => a.Category === category);
        }

        const msgContainer = document.getElementById('no-activity-msg');
        const listContainer = document.getElementById('full-activity-list');
        
        if(!listContainer) return;

        if(filtered.length === 0) {
            listContainer.innerHTML = '';
            if(msgContainer) msgContainer.classList.remove('hidden');
        } else {
            if(msgContainer) msgContainer.classList.add('hidden');
            this.renderActList(filtered, 'full-activity-list');
        }
    },

    renderActList(list, targetId) {
        const container = document.getElementById(targetId);
        if(!container) return;
        container.innerHTML = list.map((a, index) => `
            <div data-aos="fade-up" data-aos-delay="${(index % 3) * 100}" onclick='app.openModal(${JSON.stringify(a).replace(/'/g, "&#39;")})' class="cursor-pointer bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition group border border-gray-100 transform hover:-translate-y-1">
                <div class="w-full bg-gray-50 relative">
                    <img src="${a.ImageURL || 'https://via.placeholder.com/300'}" class="w-full h-auto object-contain max-h-[500px] mx-auto">
                    <span class="absolute top-2 right-2 bg-white/90 px-2 py-1 text-xs rounded shadow font-bold text-p-dark">${a.Category || 'General'}</span>
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-lg text-gray-800 mb-2">${a.Title}</h3>
                    <p class="text-sm text-gray-600 line-clamp-2">${a.Description}</p>
                </div>
            </div>
        `).join('');
    },

    // --- MODALS ---
    openModal(activity) {
        const imgEl = document.getElementById('modal-img');
        if(imgEl) imgEl.src = activity.ImageURL || 'https://via.placeholder.com/600';
        
        const catEl = document.getElementById('modal-cat');
        if(catEl) catEl.innerText = activity.Category || 'Activity';
        
        const titleEl = document.getElementById('modal-title');
        if(titleEl) titleEl.innerText = activity.Title;
        
        const descEl = document.getElementById('modal-desc');
        if(descEl) descEl.innerText = activity.Description;
        
        const modal = document.getElementById('activity-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; 
        }
    },

    openEduModal(edu) {
        const logoEl = document.getElementById('edu-modal-logo');
        if(logoEl) logoEl.src = edu.LogoURL || 'https://via.placeholder.com/150';
        
        const yearEl = document.getElementById('edu-modal-year');
        if(yearEl) yearEl.innerText = edu.Year || '-';
        
        const schoolEl = document.getElementById('edu-modal-school');
        if(schoolEl) schoolEl.innerText = edu.School || 'Unknown';
        
        const levelEl = document.getElementById('edu-modal-level');
        if(levelEl) levelEl.innerText = edu.Level || '-';
        
        const gpaEl = document.getElementById('edu-modal-gpa');
        if(gpaEl) gpaEl.innerText = edu.GPA || '-';
        
        const modal = document.getElementById('education-modal');
        if(modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(event) {
        if (event && !event.target.classList.contains('fixed')) return; 
        
        const actModal = document.getElementById('activity-modal');
        const eduModal = document.getElementById('education-modal');
        
        if(actModal) actModal.classList.add('hidden');
        if(eduModal) eduModal.classList.add('hidden');
        document.body.style.overflow = 'auto'; 
    },

    // --- AUTH & DASHBOARD ---
    async login(e) {
        e.preventDefault();
        const u = document.getElementById('u').value;
        const p = document.getElementById('p').value;
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        // Scale loading animation on button
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> กำลังโหลด...';
        btn.classList.add('btn-loading');

        try {
            const res = await fetch(APPS_SCRIPT_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action: 'login', username: u, password: p }) 
            });
            const json = await res.json();
            
            if(json.status === 'success') {
                btn.innerHTML = '<i class="fas fa-check"></i> สำเร็จ!';
                btn.classList.replace('bg-p-dark', 'bg-green-500');
                localStorage.setItem('token', json.token);
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 800);
            } else { 
                alert('Login Failed');
                btn.innerHTML = originalText;
                btn.classList.remove('btn-loading');
            }
        } catch(err) {
            alert('Connection Error');
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
        }
    },

    logout() {
        this.toggleLoader(true, "กำลังออกจากระบบ...");
        setTimeout(() => {
            localStorage.removeItem('token');
            window.location.href = 'admin.html';
        }, 2000);
    },

    switchDashTab(tabName, eventObj) {
        document.querySelectorAll('.dash-content').forEach(el => el.classList.add('hidden'));
        const targetTab = document.getElementById(`dash-${tabName}`);
        if(targetTab) targetTab.classList.remove('hidden');
        
        document.querySelectorAll('.dash-tab').forEach(el => el.classList.remove('border-p-dark', 'font-bold'));
        if(eventObj && eventObj.target) {
            eventObj.target.classList.add('border-p-dark', 'font-bold');
        } else if (typeof eventObj === 'object' && eventObj instanceof HTMLElement) {
            eventObj.classList.add('border-p-dark', 'font-bold');
        }
    },

    renderDashboard() {
        const { profile, education, activities } = this.data;
        document.getElementById('d-name').value = profile.name || '';
        document.getElementById('d-bio').value = profile.bio || '';
        document.getElementById('d-img').value = profile.image || '';
        document.getElementById('d-email').value = profile.email || '';
        document.getElementById('d-phone').value = profile.phone || '';
        document.getElementById('d-fb').value = profile.facebook || '';
        document.getElementById('d-ig').value = profile.instagram || '';
        document.getElementById('d-line').value = profile.line || '';

        document.getElementById('dash-edu-list').innerHTML = education.map(e => `
            <div class="flex justify-between items-center bg-white p-3 rounded border hover:bg-gray-50">
                <div class="flex items-center gap-3">
                    <img src="${e.LogoURL || 'https://via.placeholder.com/50'}" class="w-10 h-10 object-contain bg-white border rounded">
                    <div><span class="font-bold text-p-dark">${e.Year}</span> ${e.School}</div>
                </div>
                <div class="space-x-2">
                    <button onclick='app.editEdu(${JSON.stringify(e)})' class="text-blue-500 text-sm hover:underline font-medium">แก้ไข</button>
                    <button onclick="app.deleteItem('education', '${e.ID}')" class="text-red-500 text-sm hover:underline font-medium">ลบ</button>
                </div>
            </div>
        `).join('');

        document.getElementById('dash-act-list').innerHTML = activities.map(a => `
            <div class="bg-white p-3 rounded border flex gap-3 relative hover:shadow-sm transition items-start">
                <img src="${a.ImageURL || 'https://via.placeholder.com/150'}" class="w-20 h-20 object-contain bg-gray-100 rounded border flex-shrink-0">
                <div class="flex-grow overflow-hidden">
                    <div class="font-bold truncate text-gray-800">${a.Title}</div>
                    <div class="text-xs text-gray-500 mb-1">${a.Category}</div>
                    <div class="text-xs text-gray-400 truncate">${a.Description}</div>
                </div>
                <div class="absolute top-2 right-2 space-x-1 bg-white/90 p-1 rounded shadow-sm">
                    <button onclick='app.editAct(${JSON.stringify(a)})' class="text-blue-500 text-xs p-1 hover:bg-blue-50 rounded"><i class="fas fa-pen"></i></button>
                    <button onclick="app.deleteItem('activities', '${a.ID}')" class="text-red-500 text-xs p-1 hover:bg-red-50 rounded"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    },

    async saveProfile(e) {
        e.preventDefault();
        await this.post({
            action: 'updateProfile',
            profile: {
                name: document.getElementById('d-name').value,
                bio: document.getElementById('d-bio').value,
                image: document.getElementById('d-img').value,
                email: document.getElementById('d-email').value,
                phone: document.getElementById('d-phone').value,
                facebook: document.getElementById('d-fb').value,
                instagram: document.getElementById('d-ig').value,
                line: document.getElementById('d-line').value
            }
        });
        alert('Profile Saved');
        await this.fetchData(); 
    },

    editEdu(item) {
        document.getElementById('edu-id').value = item.ID;
        document.getElementById('edu-year').value = item.Year;
        document.getElementById('edu-level').value = item.Level;
        document.getElementById('edu-school').value = item.School;
        document.getElementById('edu-gpa').value = item.GPA;
        document.getElementById('edu-logo').value = item.LogoURL || ''; 
        
        document.getElementById('edu-submit-btn').innerText = "บันทึกการแก้ไข";
        document.getElementById('edu-submit-btn').classList.replace('bg-green-500', 'bg-blue-500');
        document.getElementById('edu-submit-btn').classList.replace('hover:bg-green-600', 'hover:bg-blue-600');
        document.getElementById('edu-cancel-btn').classList.remove('hidden');
        document.getElementById('edu-form-title').innerText = "แก้ไขข้อมูลการศึกษา";
        
        window.scrollTo(0,0);
    },
    resetEduForm() {
        document.getElementById('edu-id').value = "";
        document.getElementById('edu-year').value = "";
        document.getElementById('edu-level').value = "";
        document.getElementById('edu-school').value = "";
        document.getElementById('edu-gpa').value = "";
        document.getElementById('edu-logo').value = "";
        
        document.getElementById('edu-submit-btn').innerText = "เพิ่มรายการ";
        document.getElementById('edu-submit-btn').classList.replace('bg-blue-500', 'bg-green-500');
        document.getElementById('edu-submit-btn').classList.replace('hover:bg-blue-600', 'hover:bg-green-600');
        document.getElementById('edu-cancel-btn').classList.add('hidden');
        document.getElementById('edu-form-title').innerText = "เพิ่มข้อมูลการศึกษาใหม่";
    },
    async saveEducation(e) {
        e.preventDefault();
        const id = document.getElementById('edu-id').value;
        await this.post({
            action: id ? 'edit' : 'add',
            type: 'education',
            id: id,
            year: document.getElementById('edu-year').value,
            level: document.getElementById('edu-level').value,
            school: document.getElementById('edu-school').value,
            gpa: document.getElementById('edu-gpa').value,
            logo: document.getElementById('edu-logo').value
        });
        this.resetEduForm();
        await this.fetchData();
    },

    handleCatChange(el) {
        const customInput = document.getElementById('act-cat-custom');
        if (el.value === 'อื่นๆ') {
            customInput.classList.remove('hidden');
            customInput.required = true;
        } else {
            customInput.classList.add('hidden');
            customInput.required = false;
            customInput.value = ''; 
        }
    },

    editAct(item) {
        document.getElementById('act-id').value = item.ID;
        document.getElementById('act-title').value = item.Title;
        document.getElementById('act-desc').value = item.Description;
        document.getElementById('act-img').value = item.ImageURL;

        const select = document.getElementById('act-cat');
        const customInput = document.getElementById('act-cat-custom');
        const options = Array.from(select.options).map(o => o.value);

        if (options.includes(item.Category)) {
            select.value = item.Category;
            customInput.classList.add('hidden');
        } else {
            select.value = 'อื่นๆ';
            customInput.value = item.Category;
            customInput.classList.remove('hidden');
        }

        document.getElementById('act-submit-btn').innerText = "บันทึกการแก้ไข";
        document.getElementById('act-submit-btn').classList.replace('bg-purple-500', 'bg-blue-500');
        document.getElementById('act-cancel-btn').classList.remove('hidden');
        document.getElementById('act-form-title').innerText = "แก้ไขกิจกรรม";
        window.scrollTo(0,0);
    },

    resetActForm() {
        document.getElementById('act-id').value = "";
        document.getElementById('act-title').value = "";
        document.getElementById('act-desc').value = "";
        const select = document.getElementById('act-cat');
        if(select && select.options.length > 0) {
            select.value = select.options[0].value;
        }
        document.getElementById('act-cat-custom').value = "";
        document.getElementById('act-cat-custom').classList.add('hidden');
        document.getElementById('act-img').value = "";

        document.getElementById('act-submit-btn').innerText = "เพิ่มกิจกรรม";
        document.getElementById('act-submit-btn').classList.replace('bg-blue-500', 'bg-purple-500');
        document.getElementById('act-cancel-btn').classList.add('hidden');
        document.getElementById('act-form-title').innerText = "เพิ่มกิจกรรมใหม่";
    },

    async saveActivity(e) {
        e.preventDefault();
        const id = document.getElementById('act-id').value;
        
        let category = document.getElementById('act-cat').value;
        if (category === 'อื่นๆ') {
            category = document.getElementById('act-cat-custom').value;
            if(!category.trim()) { alert('กรุณาระบุหมวดหมู่เพิ่มเติม'); return; }
        }

        await this.post({
            action: id ? 'edit' : 'add',
            type: 'activities',
            id: id,
            title: document.getElementById('act-title').value,
            desc: document.getElementById('act-desc').value,
            category: category,
            image: document.getElementById('act-img').value
        });
        this.resetActForm();
        await this.fetchData();
    },

    async deleteItem(type, id) {
        if(!confirm("ต้องการลบรายการนี้ใช่ไหม?")) return;
        await this.post({ action: 'delete', type, id });
        await this.fetchData();
    }
};

window.onload = () => app.init();
