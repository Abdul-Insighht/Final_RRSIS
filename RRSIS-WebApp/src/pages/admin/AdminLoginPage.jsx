import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

const AdminLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { adminLogin } = useAdminAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await adminLogin(email, password);

            if (result.success) {
                navigate('/admin/dashboard');
            } else {
                setError(result.error || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            console.error('Admin login error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-dark pt-16">
            <main className="flex-1 flex items-center justify-center p-4 py-12 relative">
                {/* Background */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] opacity-40"></div>
                    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-sky-blue/10 rounded-full blur-[100px] opacity-30"></div>
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]"></div>
                </div>

                <div className="w-full max-w-6xl z-10 grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Side: Marketing */}
                    <div className="hidden lg:flex flex-col gap-8 pr-8">
                        <div className="space-y-4">
                            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white">
                                Admin Portal for <span className="text-primary">GeoSegAI</span>
                            </h1>
                            <p className="text-lg text-text-muted leading-relaxed max-w-lg">
                                Manage users, configure system settings, and oversee all segmentation operations from this centralized admin dashboard.
                            </p>
                        </div>

                        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-border-dark group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 flex flex-col justify-end p-6">
                                <p className="text-white font-medium text-sm">System Administration • GeoSegAI Platform</p>
                            </div>
                            <img
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCq22vIhZ_UYSywUT3XZZb6LphMbjEM2LooGsfLMqrorm1Viz0uWCkIdx7XHp54ZdeScOyTkJzyZ5y4bASCTKle5rC0cn-W4J8FiZTvwSD_P0eXEL84pdHWutS3pK9B66RGDFyvZN9dw61GZevYBfCN1Vw9aNvqjlkVJs3T1vSAOXZGTrub5tgVLNuSUw3EXGgReaitwqqKPGW8eZNFLyhmbT5tkH0yh_rystvlwbum02wYAuC64D4pD7uKbALTtsKptqGe8_U9NOmh"
                                alt="Admin dashboard view"
                                className="object-cover w-full h-full transform transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur-md text-xs text-white px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                Admin Access
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
                                <p>Secure Administrative Access</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Login Form */}
                    <div className="w-full max-w-md mx-auto bg-surface-dark border border-border-dark rounded-2xl shadow-xl p-6 sm:p-8">
                        <div className="mb-8 text-center lg:text-left">
                            <h2 className="text-2xl font-bold text-white mb-2">Admin Login</h2>
                            <p className="text-sm text-text-muted">Access the administrative dashboard</p>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5" htmlFor="email">Email Address</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@geosegai.ai"
                                    className="block w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-11 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5" htmlFor="password">Password</label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="block w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-11 px-4 pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-white"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="mt-4 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-dark transition-colors disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                                        Logging in...
                                    </>
                                ) : (
                                    'Log In as Admin'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-text-muted">
                                Not an admin?{' '}
                                <Link to="/login" className="font-medium text-sky-blue hover:underline">User Login</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminLoginPage;
