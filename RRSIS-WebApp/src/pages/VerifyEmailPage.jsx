import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const VerifyEmailPage = () => {
    const { user, resendVerificationEmail, logout } = useAuth();
    const navigate = useNavigate();
    const [isResending, setIsResending] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    useEffect(() => {
        // Redirect if no user or already verified (Google logins are auto-verified)
        if (!user) {
            navigate('/login');
        } else if (user.emailVerified) {
            navigate('/dashboard');
        }

        // Set up periodic check for verification status
        const intervalId = setInterval(async () => {
            if (user) {
                await user.reload(); // Refresh the user object
                if (user.emailVerified) {
                    navigate('/dashboard');
                }
            }
        }, 5000); // Check every 5 seconds

        return () => clearInterval(intervalId);
    }, [user, navigate]);

    const handleResend = async () => {
        if (cooldown > 0) return;

        setIsResending(true);
        setMessage('');
        setError('');

        const result = await resendVerificationEmail();

        if (result.success) {
            setMessage('Verification email sent! Please check your inbox (and spam folder).');
            setCooldown(60); // Start 60s cooldown
        } else {
            if (result.error && result.error.includes('too-many-requests')) {
                setError('Too many attempts. Please wait a few minutes before trying again.');
                setCooldown(60); // Enforce cooldown even on error if it's rate limit
            } else {
                setError(result.error || 'Failed to send verification email. Please try again later.');
            }
        }

        setIsResending(false);
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-surface-dark border border-border-dark rounded-2xl shadow-xl p-8 text-center animate-fadeIn">
                <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-4xl text-primary">mark_email_unread</span>
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">Verify your email</h1>
                <p className="text-text-muted mb-6">
                    We've sent a verification link to <br />
                    <span className="font-mono text-white bg-black/20 px-2 py-0.5 rounded">{user.email}</span>
                </p>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-200">
                        Please verify your email address to access the dashboard and start segmenting images.
                    </p>
                </div>

                {message && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-6 text-green-400 text-sm">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleResend}
                        disabled={isResending || cooldown > 0}
                        className="w-full py-3 px-4 bg-primary hover:bg-green-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isResending ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                Sending...
                            </>
                        ) : cooldown > 0 ? (
                            `Resend available in ${cooldown}s`
                        ) : (
                            'Resend Verification Email'
                        )}
                    </button>

                    <button
                        onClick={() => logout()}
                        className="w-full py-3 px-4 bg-transparent hover:bg-white/5 text-text-muted hover:text-white font-medium rounded-lg transition-colors"
                    >
                        Sign Out
                    </button>
                </div>

                <p className="mt-8 text-xs text-text-muted">
                    Didn't receive the email? Check your spam folder or wait a few minutes before resending.
                </p>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
