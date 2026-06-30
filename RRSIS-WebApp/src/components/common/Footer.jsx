import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="bg-background-dark border-t border-white/10 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand */}
                    <div className="col-span-1 lg:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white text-xs">
                                <span className="material-symbols-outlined text-[16px]">satellite_alt</span>
                            </div>
                            <span className="font-display font-bold text-lg text-white">GeoSegAI</span>
                        </div>
                        <p className="text-text-muted text-sm leading-relaxed mb-6">
                            Advanced AI solution for remote sensing segmentations. Turning pixels into actionable insights.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="text-text-muted hover:text-white transition-colors">
                                <span className="material-symbols-outlined">public</span>
                            </a>
                            <a href="#" className="text-text-muted hover:text-white transition-colors">
                                <span className="material-symbols-outlined">alternate_email</span>
                            </a>
                            <a href="#" className="text-text-muted hover:text-white transition-colors">
                                <span className="material-symbols-outlined">rss_feed</span>
                            </a>
                        </div>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="text-white font-bold mb-4">Product</h4>
                        <ul className="space-y-2 text-sm text-text-muted">
                            <li><a href="/#features" className="hover:text-primary transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">API</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Showcase</a></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-white font-bold mb-4">Resources</h4>
                        <ul className="space-y-2 text-sm text-text-muted">
                            <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Community</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">GitHub</a></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-white font-bold mb-4">Company</h4>
                        <ul className="space-y-2 text-sm text-text-muted">
                            <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-text-muted text-sm">© 2026 GeoSegAI Inc. All rights reserved.</p>
                    <div className="flex gap-6 text-sm text-text-muted">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
