import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

const DiagnosticPage = () => {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchAllUsers = async () => {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            const allUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(allUsers);
        };
        fetchAllUsers();
    }, []);

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-white mb-6">User Diagnostic</h1>

            <div className="bg-surface-dark rounded-xl border border-border-dark p-6">
                <table className="w-full text-white text-sm">
                    <thead>
                        <tr className="border-b border-border-dark">
                            <th className="text-left pb-2">Email</th>
                            <th className="text-left pb-2">Role</th>
                            <th className="text-left pb-2">Status</th>
                            <th className="text-left pb-2">Status Type</th>
                            <th className="text-left pb-2">Has Status Field?</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b border-border-dark/50">
                                <td className="py-3">{user.email}</td>
                                <td className="py-3">{user.role || 'N/A'}</td>
                                <td className="py-3 font-mono bg-black/20 px-2 rounded">
                                    "{user.status}"
                                </td>
                                <td className="py-3">{typeof user.status}</td>
                                <td className="py-3">
                                    {user.hasOwnProperty('status') ? '✅ Yes' : '❌ No'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DiagnosticPage;
