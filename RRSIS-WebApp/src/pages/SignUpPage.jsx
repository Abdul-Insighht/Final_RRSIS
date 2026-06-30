import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SignUpPage = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        userType: 'researcher',
        password: '',
        confirmPassword: '',
        terms: false
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const { signup, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (!formData.terms) {
            setError('Please accept the Terms of Service');
            return;
        }

        setIsLoading(true);

        try {
            const result = await signup(formData.email, formData.password, formData.fullName, formData.userType);

            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Signup failed. Please try again.');
            }
        } catch (err) {
            console.error('Signup error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setError('');
        setIsGoogleLoading(true);

        try {
            const result = await loginWithGoogle();
            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Google sign-up failed.');
            }
        } catch (err) {
            console.error('Google signup error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-16">
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
                                Unlock AI-powered insights for <span className="text-primary">remote sensing</span>.
                            </h1>
                            <p className="text-lg text-text-muted leading-relaxed max-w-lg">
                                Join thousands of researchers and students using our platform to segment satellite imagery with state-of-the-art accuracy.
                            </p>
                        </div>

                        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-border-dark group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 flex flex-col justify-end p-6">
                                <p className="text-white font-medium text-sm">Segmentation Overlay • Amazon Rainforest</p>
                            </div>
                            <img
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCq22vIhZ_UYSywUT3XZZb6LphMbjEM2LooGsfLMqrorm1Viz0uWCkIdx7XHp54ZdeScOyTkJzyZ5y4bASCTKle5rC0cn-W4J8FiZTvwSD_P0eXEL84pdHWutS3pK9B66RGDFyvZN9dw61GZevYBfCN1Vw9aNvqjlkVJs3T1vSAOXZGTrub5tgVLNuSUw3EXGgReaitwqqKPGW8eZNFLyhmbT5tkH0yh_rystvlwbum02wYAuC64D4pD7uKbALTtsKptqGe8_U9NOmh"
                                alt="Satellite view"
                                className="object-cover w-full h-full transform transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute top-4 right-4 z-20 bg-black/40 backdrop-blur-md text-xs text-white px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                Processing Complete
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Sign Up Form */}
                    <div className="w-full max-w-md mx-auto bg-surface-dark border border-border-dark rounded-2xl shadow-xl p-6 sm:p-8">
                        <div className="mb-8 text-center lg:text-left">
                            <h2 className="text-2xl font-bold text-white mb-2">Create your account</h2>
                            <p className="text-sm text-text-muted">Start your free trail with 20 credits.</p>
                        </div>

                        {/* Social Login */}
                        <div className="grid grid-cols-1 gap-3 mb-6">
                            <button
                                type="button"
                                onClick={handleGoogleSignup}
                                disabled={isGoogleLoading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-panel-dark hover:bg-white/10 border border-border-dark rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                            >
                                {isGoogleLoading ? (
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                ) : (
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4" />
                                        <path d="M12.24 24.0008C15.4766 24.0008 18.2059 22.9382 20.19 21.1039L16.323 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.24 24.0008Z" fill="#34A853" />
                                        <path d="M5.50253 14.3003C5.00236 12.8099 5.00236 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC05" />
                                        <path d="M12.24 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.24 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.24 4.74966Z" fill="#EA4335" />
                                    </svg>
                                )}
                                {isGoogleLoading ? 'Signing up...' : 'Continue with Google'}
                            </button>
                        </div>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border-dark"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-surface-dark text-text-muted">Or continue with</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5" htmlFor="fullName">Full Name</label>
                                <input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="Dr. Umer"
                                    className="block w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-11 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5" htmlFor="email">Email Address</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="abc@gmail.com"
                                    className="block w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-11 px-4"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5" htmlFor="userType">Category</label>
                                <select
                                    id="userType"
                                    name="userType"
                                    value={formData.userType}
                                    onChange={handleChange}
                                    className="block w-full rounded-lg border-border-dark bg-input-bg-dark text-white focus:border-primary focus:ring-primary text-sm h-11 px-4"
                                >
                                    <option value="researcher">Researcher</option>
                                    <option value="student">Student</option>
                                    <option value="professional">Professional</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1.5" htmlFor="password">Password</label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={handleChange}
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

                                <div>
                                    <label className="block text-sm font-medium text-white mb-1.5" htmlFor="confirmPassword">Confirm</label>
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                        className="block w-full rounded-lg border-border-dark bg-input-bg-dark text-white placeholder-text-muted focus:border-primary focus:ring-primary text-sm h-11 px-4"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-3 mt-2">
                                <div className="flex h-5 items-center">
                                    <input
                                        id="terms"
                                        name="terms"
                                        type="checkbox"
                                        checked={formData.terms}
                                        onChange={handleChange}
                                        className="h-4 w-4 rounded border-border-dark text-primary focus:ring-primary bg-input-bg-dark"
                                    />
                                </div>
                                <div className="text-xs text-text-muted">
                                    <label className="font-medium text-gray-300" htmlFor="terms">
                                        I agree to the <a className="text-sky-blue hover:underline" href="#">Terms of Service</a> and <a className="text-sky-blue hover:underline" href="#">Privacy Policy</a>
                                    </label>
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
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-text-muted">
                                Already have an account?{' '}
                                <Link to="/login" className="font-medium text-sky-blue hover:underline">Log in</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SignUpPage;
