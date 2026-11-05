// --- NEW: How It Works Component ---
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import SearchBar from '../components/SearchBar';
import FeaturedJobs from '../components/FeaturedJobs';
import Testimonials from '../components/Testimonials';
import PostTestimonial from '../components/PostTestimonial';


// Define color constants
const INDIGO_COLOR = '#4f46e5'; // Primary color (Indigo-600 equivalent)
const TEAL_COLOR = '#14b8a6'; // Teal-500
const ORANGE_COLOR = '#f97316'; // Orange-500

const HowItWorks = () => {
    const { t } = useTranslation();
    const steps = [
        {
            step: 1,
            title: t('home.howItWorks.step1Title'),
            description: t('home.howItWorks.step1Description'),
            icon: 'bi-search',
            color: INDIGO_COLOR
        },
        {
            step: 2,
            title: t('home.howItWorks.step2Title'),
            description: t('home.howItWorks.step2Description'),
            icon: 'bi-send-check',
            color: TEAL_COLOR
        },
        {
            step: 3,
            title: t('home.howItWorks.step3Title'),
            description: t('home.howItWorks.step3Description'),
            icon: 'bi-check-circle',
            color: ORANGE_COLOR
        }
    ];

    return (
        <div className="container py-5">
            <div className="text-center mb-5">
                <h2 className="display-6 fw-bold text-dark mb-3">{t('home.howItWorks.title')}</h2>
                <p className="lead text-muted">{t('home.howItWorks.subtitle')}</p>
            </div>

            <div className="row g-4 justify-content-center">
                {steps.map((step, index) => (
                    <div className="col-lg-4 col-md-6" key={index}>
                        <div className="card h-100 border-0 shadow-lg rounded-4 text-center p-4 step-card fade-in-up"
                             style={{ animationDelay: `${index * 0.2}s` }}>
                            <div className="step-number mb-3">
                                <span className="badge rounded-pill fs-6 fw-bold px-3 py-2"
                                      style={{ backgroundColor: step.color, color: 'white' }}>
                                    {step.step}
                                </span>
                            </div>
                            <div className="step-icon mb-3">
                                <i className={`bi ${step.icon} display-4`} style={{ color: step.color }}></i>
                            </div>
                            <h5 className="card-title fw-bold text-dark mb-3">{step.title}</h5>
                            <p className="card-text text-muted">{step.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .step-card {
                    transition: all 0.3s ease;
                    border-top: 4px solid transparent;
                }
                .step-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 1rem 3rem rgba(0,0,0,.2) !important;
                    border-top-color: ${INDIGO_COLOR};
                }
                .fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                    opacity: 0;
                    transform: translateY(30px);
                }
                @keyframes fadeInUp {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

// --- NEW: Job Preview Modal Component ---
const JobPreviewModal = ({ job, show, onClose }) => {
    const { t } = useTranslation();
    if (!show || !job) return null;

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content border-0 shadow-lg rounded-4">
                    <div className="modal-header border-0">
                        <h5 className="modal-title fw-bold">{job.title}</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4">
                        <div className="row">
                            <div className="col-md-8">
                                <p className="text-muted mb-3"><i className="bi bi-building me-2"></i>{job.companyName}</p>
                                <p className="text-muted mb-3"><i className="bi bi-geo-alt me-2"></i>{job.location}</p>
                                <p className="text-muted mb-3"><i className="bi bi-cash me-2"></i>₹{job.salary?.toLocaleString() || t('home.jobPreview.negotiable')}</p>
                                <p className="text-muted mb-3"><i className="bi bi-briefcase me-2"></i>{job.type || t('home.jobPreview.fullTime')}</p>
                                <p className="mt-4">{job.description}</p>
                            </div>
                            <div className="col-md-4 text-center">
                                <div className="bg-light p-4 rounded-3 mb-3">
                                    <i className="bi bi-building-fill fs-1 text-primary mb-3"></i>
                                    <p className="small text-muted">{t('home.jobPreview.companyVerified')}</p>
                                </div>
                                <Link to={`/jobs/${job._id}`} className="btn btn-primary w-100 rounded-pill"
                                      onClick={onClose}>
                                    {t('home.jobPreview.viewFullDetails')}
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 5. Main HomePage Component ---
const HomePage = () => {
    const { t } = useTranslation();
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);

    // State for job preview modal
    const [selectedJob, setSelectedJob] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const closeModal = () => {
        setShowModal(false);
        setSelectedJob(null);
    };

    const getCategoryTranslationKey = (name = '') => {
        const normalized = String(name).trim().toLowerCase();
        const map = {
            construction: 'construction',
            'delivery & driving': 'deliveryDriving',
            housekeeping: 'housekeeping',
            'factory work': 'factoryWork',
            security: 'security',
            'retail & shop': 'retailShop',
            services: 'services',
            maintenance: 'maintenance',
            logistics: 'logistics',
            hospitality: 'hospitality',
            'office/bpo': 'officeBpo',
            cleaning: 'cleaning',
            healthcare: 'healthcare',
            warehouse: 'warehouse',
            vehicle: 'vehicle',
            retail: 'retail',
            automotive: 'automotive',
            driving: 'driving'
        };

        return map[normalized] || null;
    };

    // Initial testimonials data
    const initialTestimonials = [
        {
            quote: t('testimonials.samples.ganesh.quote'),
            author: "Ganesh Singh",
            location: "Bengaluru",
            role: t('testimonials.samples.ganesh.role'),
            rating: 5,
            icon: "bi-hammer"
        },
        {
            quote: t('testimonials.samples.pooja.quote'),
            author: "Pooja Devi",
            location: "Mumbai",
            role: t('testimonials.samples.pooja.role'),
            rating: 5,
            icon: "bi-house-heart"
        },
        {
            quote: t('testimonials.samples.rajesh.quote'),
            author: "Rajesh Kumar",
            location: "Delhi",
            role: t('testimonials.samples.rajesh.role'),
            rating: 4,
            icon: "bi-shield-check"
        },
    ];

    const [testimonials, setTestimonials] = useState(initialTestimonials);
    const [loadingTestimonials, setLoadingTestimonials] = useState(false);

    const handleAddTestimonial = (newTestimonial) => {
        setTestimonials(prev => [newTestimonial, ...prev]);
    };

    // Fetch testimonials from backend
    const fetchTestimonials = async () => {
        setLoadingTestimonials(true);
        try {
            const response = await fetch('/api/v1/testimonials');
            if (response.ok) {
                const data = await response.json();
                // Combine static testimonials with fetched ones
                setTestimonials(prev => [...data.testimonials, ...initialTestimonials]);
            }
        } catch (error) {
            console.error('Error fetching testimonials:', error);
            // Keep initial testimonials if fetch fails
        } finally {
            setLoadingTestimonials(false);
        }
    };

    // Fetch job counts by category
    const fetchCategoryCounts = async () => {
        setLoadingCategories(true);
        try {
            const response = await fetch('/api/v1/jobs/categories/counts');
            if (response.ok) {
                const data = await response.json();
                // Map counts to categories with icons
                const categoryIcons = {
                    'Construction': 'bi-tools',
                    'Delivery & Driving': 'bi-truck',
                    'Housekeeping': 'bi-house',
                    'Factory Work': 'bi-gear',
                    'Security': 'bi-shield',
                    'Retail & Shop': 'bi-shop'
                };

                const mappedCategories = data.categories.map(cat => ({
                    name: cat.category,
                    icon: `bi ${categoryIcons[cat.category] || 'bi-briefcase'}`,
                    jobs: cat.count
                }));

                setCategories(mappedCategories);
            }
        } catch (error) {
            console.error('Error fetching category counts:', error);
            // Fallback to default categories if fetch fails
            setCategories([
                { name: 'Construction', icon: 'bi bi-tools', jobs: 0 },
                { name: 'Delivery & Driving', icon: 'bi bi-truck', jobs: 0 },
                { name: 'Housekeeping', icon: 'bi bi-house', jobs: 0 },
                { name: 'Factory Work', icon: 'bi bi-gear', jobs: 0 },
                { name: 'Security', icon: 'bi bi-shield', jobs: 0 },
                { name: 'Retail & Shop', icon: 'bi bi-shop', jobs: 0 },
            ]);
        } finally {
            setLoadingCategories(false);
        }
    };

    useEffect(() => {
        fetchTestimonials();
        fetchCategoryCounts();
    }, []); // Fixed exhaustive-deps

    useEffect(() => {
        // Initialize tooltips after component mounts
        const initTooltips = () => {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.forEach(function (tooltipTriggerEl) {
                if (window.bootstrap && window.bootstrap.Tooltip) {
                    new window.bootstrap.Tooltip(tooltipTriggerEl);
                }
            });
        };

        // Small delay to ensure Bootstrap is loaded
        const timer = setTimeout(initTooltips, 100);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="pt-5">
            {/* 1. Hero Section (SearchBar) */}
            <SearchBar />

            <div className="container py-5">
                {/* 2. Stats Section */}
                <div className="row g-4 justify-content-center text-center bg-white rounded-4 shadow-lg p-5 my-5">
                    <div className="col-6 col-md-3">
                        <i className="bi bi-briefcase fs-1 mb-2" style={{ color: INDIGO_COLOR, fontSize: '2.5rem' }}></i>
                        <p className="fs-3 fw-bold text-dark">1000+</p>
                        <p className="text-muted">{t('home.stats.jobsPosted')}</p>
                    </div>
                    <div className="col-6 col-md-3">
                        <i className="bi bi-people fs-1 mb-2" style={{ color: INDIGO_COLOR, fontSize: '2.5rem' }}></i>
                        <p className="fs-3 fw-bold text-dark">50K+</p>
                        <p className="text-muted">{t('home.stats.jobSeekers')}</p>
                    </div>
                    <div className="col-6 col-md-3">
                        <i className="bi bi-pin-map fs-1 mb-2" style={{ color: INDIGO_COLOR, fontSize: '2.5rem' }}></i>
                        <p className="fs-3 fw-bold text-dark">200+</p>
                        <p className="text-muted">{t('home.stats.citiesInIndia')}</p>
                    </div>
                    <div className="col-6 col-md-3">
                        <i className="bi bi-patch-plus fs-1 mb-2" style={{ color: INDIGO_COLOR, fontSize: '2.5rem' }}></i>
                        <p className="fs-3 fw-bold text-dark">50+</p>
                        <p className="text-muted">{t('home.stats.newJobsDaily')}</p>
                    </div>
                </div>

                {/* 3. Categories Section */}
                <h2 className="text-center mb-5 fw-bold">{t('home.popularCategories')}</h2>
                <div className="row g-4 mb-5">
                    {loadingCategories ? (
                        // Show skeleton loading for categories
                        Array(6).fill(0).map((_, index) => (
                            <div className="col-md-4 col-lg-2" key={index}>
                                <div className="card text-center h-100 shadow-sm border-0 rounded-4 p-3">
                                    <div className="bg-light rounded-3 mb-2" style={{ width: '40px', height: '40px', margin: '0 auto' }}></div>
                                    <div className="bg-light rounded mb-1" style={{ height: '16px', width: '80%', margin: '0 auto' }}></div>
                                    <div className="bg-light rounded" style={{ height: '12px', width: '60%', margin: '0 auto' }}></div>
                                </div>
                            </div>
                        ))
                    ) : (
                        categories.map((cat, index) => (
                            (() => {
                                const categoryKey = getCategoryTranslationKey(cat.name);
                                const categoryLabel = categoryKey
                                    ? t(`home.categories.${categoryKey}`, { defaultValue: cat.name })
                                    : cat.name;

                                return (
                            <div className="col-md-4 col-lg-2" key={index}>
                                <Link to={`/jobs?category=${cat.name}`} className="text-decoration-none text-dark">
                    <div className="card text-center h-100 shadow-sm border-0 rounded-4 p-3 hover-scale"
                        style={{ transition: 'all 0.3s' }}
                        data-bs-toggle="tooltip"
                        title={t('home.browseJobsInCategory', { count: cat.jobs, category: categoryLabel })}>
                                        <i className={`${cat.icon} fs-3 mb-2`} style={{ color: INDIGO_COLOR }}></i>
                                        <p className="fw-semibold mb-0">{categoryLabel}</p>
                                        <p className="small text-muted mb-0">({t('home.jobsCount', { count: cat.jobs })})</p>
                                    </div>
                                </Link>
                            </div>
                                );
                            })()
                        ))
                    )}
                </div>

                {/* NEW: How It Works Section */}
                <HowItWorks />

                {/* 4. Featured Jobs Section */}
                <FeaturedJobs />

                {/* 5. CTA Section (Hiring Staff?) */}
                <div className="bg-light p-5 rounded-4 shadow-sm border-start border-4 text-center my-5" 
                    style={{ borderColor: `${INDIGO_COLOR} !important`, borderLeftColor: INDIGO_COLOR, borderLeftWidth: '6px' }}>
                    <h3 className="fw-bold text-dark mb-2">{t('home.cta.title')}</h3>
                    <p className="text-muted mb-4">{t('home.cta.description')}</p>
                    <Link to="/employer/dashboard" className="btn btn-lg btn-primary rounded-pill px-5 fw-bold" 
                        style={{ backgroundColor: INDIGO_COLOR, borderColor: INDIGO_COLOR }}>
                        <i className="bi bi-bullhorn me-2"></i> {t('home.cta.button')}
                    </Link>
                </div>

                {/* 6. Testimonials Section */}
                <Testimonials testimonials={testimonials} />

                {/* 7. Post Testimonial Form */}
                <PostTestimonial onAddTestimonial={handleAddTestimonial} />

            </div>

            {/* Job Preview Modal */}
            <JobPreviewModal job={selectedJob} show={showModal} onClose={closeModal} />

            {/* Global CSS for Category Hover Effect */}
            <style>{`
                .hover-scale:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0.5rem 1rem rgba(0,0,0,.15)!important;
                }
            `}</style>
        </div>
    );
};

export default HomePage;
