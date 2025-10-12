const translations = {
    en: {
        hero: {
            title: 'Find Your Dream Job Today',
            subtitle: 'Connect with opportunities near you',
            findJob: 'Find a Job',
            postJob: 'Post a Job'
        },
        features: {
            title: 'Why Choose JobMatch?',
            location: {
                title: 'Location-Based Matching',
                desc: 'Find jobs within your preferred radius'
            },
            smart: {
                title: 'Smart Job Matching',
                desc: 'AI-powered matching based on skills and availability'
            },
            flexible: {
                title: 'Flexible Scheduling',
                desc: 'Manage your roster and availability easily'
            }
        },
        howItWorks: {
            title: 'How It Works',
            step1: { title: 'Create Profile', desc: 'Sign up as job seeker or employer' },
            step2: { title: 'Set Preferences', desc: 'Add skills, roster, and location' },
            step3: { title: 'Get Matched', desc: 'Receive relevant job opportunities' },
            step4: { title: 'Start Working', desc: 'Clock in/out and get paid' }
        },
        cta: {
            title: 'Ready to Get Started?',
            subtitle: 'Join thousands of satisfied users',
            button: 'Sign Up Now'
        },
        register: {
            title: 'Create Account',
            name: 'Full Name',
            email: 'Email',
            phone: 'Phone Number',
            password: 'Password',
            submit: 'Register',
            hasAccount: 'Already have an account?',
            login: 'Login'
        },
        login: {
            title: 'Login',
            email: 'Email',
            password: 'Password',
            submit: 'Login',
            error: 'Invalid email or password'
        }
    },
    ms: {
        hero: {
            title: 'Cari Pekerjaan Impian Anda Hari Ini',
            subtitle: 'Berhubung dengan peluang berhampiran anda',
            findJob: 'Cari Pekerjaan',
            postJob: 'Hantar Pekerjaan'
        },
        features: {
            title: 'Mengapa Pilih JobMatch?',
            location: {
                title: 'Padanan Berasaskan Lokasi',
                desc: 'Cari pekerjaan dalam radius pilihan anda'
            },
            smart: {
                title: 'Padanan Pekerjaan Pintar',
                desc: 'Padanan berkuasa AI berdasarkan kemahiran dan ketersediaan'
            },
            flexible: {
                title: 'Jadual Fleksibel',
                desc: 'Urus roster dan ketersediaan anda dengan mudah'
            }
        },
        howItWorks: {
            title: 'Bagaimana Ia Berfungsi',
            step1: { title: 'Buat Profil', desc: 'Daftar sebagai pencari kerja atau majikan' },
            step2: { title: 'Tetapkan Keutamaan', desc: 'Tambah kemahiran, roster, dan lokasi' },
            step3: { title: 'Dapatkan Padanan', desc: 'Terima peluang pekerjaan yang berkaitan' },
            step4: { title: 'Mula Bekerja', desc: 'Daftar masuk/keluar dan dibayar' }
        },
        cta: {
            title: 'Bersedia Untuk Bermula?',
            subtitle: 'Sertai ribuan pengguna yang berpuas hati',
            button: 'Daftar Sekarang'
        },
        register: {
            title: 'Buat Akaun',
            name: 'Nama Penuh',
            email: 'E-mel',
            phone: 'Nombor Telefon',
            password: 'Kata Laluan',
            submit: 'Daftar',
            hasAccount: 'Sudah ada akaun?',
            login: 'Log Masuk'
        },
        login: {
            title: 'Log Masuk',
            email: 'E-mel',
            password: 'Kata Laluan',
            submit: 'Log Masuk',
            error: 'E-mel atau kata laluan tidak sah'
        }
    },
    zh: {
        hero: {
            title: '今天找到您的理想工作',
            subtitle: '与您附近的机会建立联系',
            findJob: '找工作',
            postJob: '发布工作'
        },
        features: {
            title: '为什么选择JobMatch？',
            location: {
                title: '基于位置的匹配',
                desc: '在您首选的范围内查找工作'
            },
            smart: {
                title: '智能工作匹配',
                desc: '基于技能和可用性的AI驱动匹配'
            },
            flexible: {
                title: '灵活的时间表',
                desc: '轻松管理您的班次和可用性'
            }
        },
        howItWorks: {
            title: '如何运作',
            step1: { title: '创建个人资料', desc: '注册为求职者或雇主' },
            step2: { title: '设置偏好', desc: '添加技能、班次和位置' },
            step3: { title: '获得匹配', desc: '接收相关的工作机会' },
            step4: { title: '开始工作', desc: '打卡上下班并获得报酬' }
        },
        cta: {
            title: '准备开始了吗？',
            subtitle: '加入数千名满意的用户',
            button: '立即注册'
        },
        register: {
            title: '创建账户',
            name: '全名',
            email: '电子邮件',
            phone: '电话号码',
            password: '密码',
            submit: '注册',
            hasAccount: '已有账户？',
            login: '登录'
        },
        login: {
            title: '登录',
            email: '电子邮件',
            password: '密码',
            submit: '登录',
            error: '电子邮件或密码无效'
        }
    }
};

function getTranslation(key) {
    const keys = key.split('.');
    let value = translations[currentLanguage];
    for (const k of keys) {
        value = value[k];
        if (!value) return key;
    }
    return value;
}

function updateTranslations() {
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        el.textContent = getTranslation(key);
    });
}