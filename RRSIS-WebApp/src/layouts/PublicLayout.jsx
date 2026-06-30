import { Link, Outlet, useLocation } from 'react-router-dom';
import Footer from '../components/common/Footer';

const PublicLayout = () => {
    const location = useLocation();
    const isAuthPage = ['/login', '/signup', '/verify-email'].includes(location.pathname);

    return (
        <div className="min-h-screen bg-background-dark text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 glass-panel">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-green-300 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined">satellite_alt</span>
                        </div>
                        <span className="font-display font-bold text-xl tracking-tight">GeoSegAI</span>
                    </Link>

                    {!isAuthPage && (
                        <>
                            <nav className="hidden md:flex items-center gap-8">
                                <a href="/#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</a>
                                <a href="/#how-it-works" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">How it Works</a>
                                <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Docs</a>
                                <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">GitHub</a>
                            </nav>

                            <div className="flex items-center gap-4">
                                <Link to="/login" className="hidden sm:flex text-sm font-medium text-slate-300 hover:text-white">
                                    Sign In
                                </Link>
                                <Link
                                    to="/login"
                                    className="bg-primary hover:bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                                >
                                    Try Demo
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main>
                <Outlet />
            </main>

            {/* Footer - hidden on auth pages */}
            {!isAuthPage && <Footer />}
        </div>
    );
};

export default PublicLayout;
