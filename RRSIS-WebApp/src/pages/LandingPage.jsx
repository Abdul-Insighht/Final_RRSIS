import { Link } from 'react-router-dom';

const LandingPage = () => {
    const demoCards = [
        {
            query: '"Find swimming pools"',
            title: 'Urban Feature Extraction',
            description: 'Identify small-scale features like pools, solar panels, or vehicles in dense urban environments.',
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPTx---mlF2umZbU3kkcfIE6I4eGqiaCYqzgqLxYB34OXSHsCmHl4DBGtz7erFqdD0W7FlGuYQJXq0LqQY9bxpudEDyB8jKR1bW87HBN99_l4uoOmyaElOg_iaHp0ZiqnUqw4qNryPKo74EfJDT-Nx9E2HRtqKIGNokeQGG67mbC16DzvR231xhn8lUt2UnaVh28p3Z_eut9d0YFSvnjLhzsqxAGIXowVfhdCm2X-wciJEpJE-dpHF3dLInw65iP6Z1-jRm12-ZYrV'
        },
        {
            query: '"Highlight deforestation areas"',
            title: 'Environmental Monitoring',
            description: 'Track land usage changes, forest density, and water bodies over time with precision.',
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDo8M1PDpsjrml13vklWaO6taGEO3Js-GYmu7FRhIIPt2-j0vOUgP0VAcLcsGCLCW6neYhc5YRlM5_GRC6vQuPVAz7g_WgORY4tiqnazWG1U9bts56vmRiWHIDRrK3DCbaGNTOBeakaGW0ig3DCavwfYHYdtVxzoFoIhslucYEz1J3gH6yzsyNCN7UPQqIiflAISlFCpeg4mJJLui3KK-o-SHSiJ9z89o_owRoZYiAsGkidsi9P7BSay7Nb4SKSHNoerl_mf3dsYSti'
        },
        {
            query: '"Segment wheat fields"',
            title: 'Agricultural Analytics',
            description: 'Differentiate crop types and monitor health at scale for precision agriculture.',
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-56_hPY4YXXi1okQEw1Bn0MpMSZ4Gfvvr0Y1HzkRr24Tqf6vW8L7rsi3geIAhQGxxRdfvVZGeC4bYyLuiKy9_x5A15PRW9FkNsI3l2Qn67_AdBcVLGc3bzmQa_AElrA_a4ccUb9ObKuRvS-tG2jA1xWeaXD6UNg94LaOTE3WeMC6y7qkVnPXkqvbUeUyO6jm5_gclayAUmxpj3iNrGsB85d2stR6T6uT-sgGOcSrLs0S0eodGl6UM32RgEAmTB_KdqmvpSQJQKoG_'
        }
    ];

    const features = [
        { icon: 'layers', title: 'Multi-class Segmentation', description: 'Simultaneously identify and mask multiple object categories in a single inference pass with high IoU scores.', color: 'primary' },
        { icon: 'translate', title: 'Language-Guided Queries', description: 'No need for training specific models. Just describe what you want to find using natural language prompts.', color: 'secondary' },
        { icon: 'map', title: 'GIS-Ready Outputs', description: 'Export masks directly as GeoTIFF, Shapefile, or GeoJSON formats ready for ArcGIS or QGIS integration.', color: 'purple-400' },
        { icon: 'bolt', title: 'Fast Inference', description: 'Optimized for GPU acceleration, processing large-scale satellite imagery in seconds, not hours.', color: 'amber-400' },
        { icon: 'folder_shared', title: 'Project Management', description: 'Organize datasets, save query history, and collaborate with your team on shared mapping projects.', color: 'rose-400' },
    ];

    const steps = [
        { icon: 'cloud_upload', title: '1. Upload Image', description: 'Upload your Jpeg, PNG, or satellite imagery directly to the platform.', color: 'secondary' },
        { icon: 'keyboard', title: '2. Input Query', description: 'Type a natural language description of the object you want to extract.', color: 'primary' },
        { icon: 'model_training', title: '3. Run Segmentation', description: 'Our AI processes the visual and textual data to generate precise masks.', color: 'amber-400' },
        { icon: 'download', title: '4. Download Results', description: 'Export your findings as shapefiles or masked images instantly.', color: 'green-400' },
    ];

    return (
        <>
            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-background-dark/80 z-10"></div>
                    <div
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCsQCRr1winJBOtBlOQPN7v088KCXqy3HQBdRJlHukGtcC7nRajpXEYzJh7uGijhYYarOeYOCipJewKO_QcA7kY9xccabWVmfgmw5jACa-2635GZAW124b7YLVnddMKTB-HR_4WPxoJ5LUMXwwjS2DusjP3pjVXs7P3lcpU7U4vSeXaqjoU4y0IIYhfGwvoARQn3_PjUF36kQlHs_xm5FlfhrQxeBRMTg2eFN1FFyZjjOk9PXOP4kZew89VP-4QbPYZOrQ_Vsy2Kl21')" }}
                    />
                </div>

                <div className="relative z-20 max-w-7xl mx-auto px-6 w-full flex flex-col lg:flex-row items-center gap-16 py-12">
                    <div className="flex-1 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-6">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            v2.0 Model Live
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight leading-[1.1] mb-6 text-white">
                            AI-Powered Referring{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Remote Sensing</span>{' '}
                            Image Segmentation
                        </h1>

                        <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                            Extract specific objects from satellite images using natural language queries.
                            From urban planning to environmental monitoring, translate words into spatial data instantly.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                            <Link
                                to="/login"
                                className="w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-green-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                                Try Demo
                            </Link>
                            <Link
                                to="/signup"
                                className="w-full sm:w-auto px-8 py-3.5 bg-transparent border border-secondary text-secondary hover:bg-secondary/10 font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                Get Started
                            </Link>
                        </div>
                    </div>

                    {/* Demo Preview Card */}
                    <div className="flex-1 w-full max-w-[600px] lg:max-w-none">
                        <div className="glass-panel rounded-xl p-2 shadow-2xl border border-white/10 relative group">
                            <div className="absolute -top-4 -left-4 bg-surface-dark border border-white/10 rounded-lg px-4 py-2 shadow-xl flex items-center gap-3 z-30">
                                <span className="material-symbols-outlined text-primary text-sm">terminal</span>
                                <code className="font-mono text-xs text-secondary">query: "Find all cargo ships"</code>
                            </div>

                            <div className="relative rounded-lg overflow-hidden aspect-[4/3] group-hover:shadow-[0_0_30px_rgba(50,164,90,0.3)] transition-shadow duration-500">
                                <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC5oQ25nkjt1iY3QYUR2UKyRf6WHcbd_rY7eI2wTw18u9TIICsO1VqalKX6puO1ytd4bjZIVY52UEJS5oJF9S5bPNPJ05d0lcs0YnoHEkNnzK7LoAT2WT5ct5Pg3djx0pIerzrDwTEHoHKNa6PdjIxLZtDodxTC-RGOALoB1qkuozmOlQKwC-_OZzDN_sCne1PU2ZQpfEKla1PZ8MBsJtuoNW8qPOVBNLBrMg-B9QDRyYf8dPfqSgQmThNy_FnA6EuDsWReR7MSf_Xg')" }}
                                />
                                <div className="absolute inset-0 bg-black/40 mix-blend-multiply"></div>

                                {/* Segmentation overlay */}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="20%" y="30%" width="15%" height="40%" rx="4" fill="rgba(50, 164, 90, 0.4)" stroke="#32a45a" strokeWidth="2" />
                                    <rect x="45%" y="25%" width="10%" height="30%" rx="4" fill="rgba(50, 164, 90, 0.4)" stroke="#32a45a" strokeWidth="2" />
                                    <rect x="60%" y="40%" width="20%" height="15%" rx="4" fill="rgba(50, 164, 90, 0.4)" stroke="#32a45a" strokeWidth="2" />
                                </svg>

                                <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur text-white text-xs font-mono py-1 px-3 rounded border border-primary/50 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                                    Confidence: 98.4%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Demo Section */}
            <section className="py-24 bg-surface-dark border-y border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-display font-bold text-white mb-4">Interactive Segmentation Demo</h2>
                        <p className="text-text-muted text-lg">See the power of language-guided segmentation. We don't just detect objects; we understand context.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {demoCards.map((card, index) => (
                            <div key={index} className="group bg-background-dark border border-white/5 rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300">
                                <div className="relative h-64 overflow-hidden">
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                        style={{ backgroundImage: `url('${card.image}')` }}
                                    />
                                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                        <span className="material-symbols-outlined text-white text-4xl drop-shadow-lg">visibility</span>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-secondary text-sm">chat</span>
                                        <code className="text-xs font-mono text-secondary bg-secondary/10 px-2 py-1 rounded">{card.query}</code>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">{card.title}</h3>
                                    <p className="text-sm text-text-muted">{card.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 bg-background-dark relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                        <div className="max-w-2xl">
                            <h2 className="text-3xl font-display font-bold text-white mb-4">Why Choose GeoSegAI?</h2>
                            <p className="text-text-muted text-lg">Built for data scientists and GIS analysts who need speed, accuracy, and flexibility.</p>
                        </div>
                        <a href="#" className="text-secondary hover:text-white font-medium flex items-center gap-2 transition-colors">
                            View Documentation
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, index) => (
                            <div key={index} className="p-8 rounded-2xl bg-surface-dark/50 border border-white/5 hover:bg-surface-dark transition-colors">
                                <div className={`w-12 h-12 bg-${feature.color}/10 rounded-lg flex items-center justify-center mb-6`}>
                                    <span className={`material-symbols-outlined text-${feature.color} text-2xl`}>{feature.icon}</span>
                                </div>
                                <h3 className="text-white text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-text-muted leading-relaxed">{feature.description}</p>
                            </div>
                        ))}

                        <div className="p-8 rounded-2xl bg-surface-dark/50 border border-white/5 hover:bg-surface-dark transition-colors flex flex-col justify-center items-center text-center">
                            <h3 className="text-white text-xl font-bold mb-3">View Full API Reference</h3>
                            <p className="text-text-muted mb-6 text-sm">Integrate GeoSegAI directly into your Python workflows.</p>
                            <button className="text-secondary font-bold hover:underline">Read the Docs</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-24 bg-surface-dark border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-display font-bold text-white mb-4">How It Works</h2>
                        <p className="text-text-muted text-lg">Go from image to insight in four simple steps.</p>
                    </div>

                    <div className="relative">
                        <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                            {steps.map((step, index) => (
                                <div key={index} className="relative flex flex-col items-center text-center">
                                    <div className="w-24 h-24 rounded-full bg-background-dark border-4 border-surface-dark flex items-center justify-center z-10 mb-6 shadow-xl">
                                        <span className={`material-symbols-outlined text-${step.color} text-4xl`}>{step.icon}</span>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                                    <p className="text-sm text-text-muted px-4">{step.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/10"></div>
                <div
                    className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-30"
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCthBFB1Slignsi9BiWmruulZaniMlKWl_qC8nmJ0puSwJSf9_-YCh8Ao-2uma-XyXd9G2Y6DElFXrFhCkh_tZ2cXujlNkX95i0UCZ0QwatkhcwyDGx4WNhMXYGflz48gRbqgvFsT_XnqgbgTQws1ygoQyXA2XgG-xBx6n5dTnHRrt9YxQWbPBOSUKU6PLaSSf75omLKk7_nWpJGWLZ2rbCwsBMSO9pCt75yHN1z5Ai6ZjnB1Nw6WKVSpx3jOfVmcdbVxCcsITXNojr')" }}
                />

                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl font-display font-bold text-white mb-6">Ready to transform your spatial data?</h2>
                    <p className="text-lg text-slate-200 mb-8">Join like researchers, data scientists, and analysts using GeoSegAI today.</p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/signup"
                            className="bg-white text-background-dark hover:bg-gray-100 text-base font-bold px-8 py-3 rounded-lg transition-colors shadow-lg"
                        >
                            Get Started Free
                        </Link>
                        <button className="bg-transparent border border-white text-white hover:bg-white/10 text-base font-bold px-8 py-3 rounded-lg transition-colors">
                            Contact Sales
                        </button>
                    </div>
                </div>
            </section>
        </>
    );
};

export default LandingPage;
