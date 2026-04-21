import React, { useEffect, useRef } from 'react';

// Reusable BentoItem component
const BentoItem = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const item = itemRef.current;
        if (!item) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = item.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            item.style.setProperty('--mouse-x', `${x}px`);
            item.style.setProperty('--mouse-y', `${y}px`);
        };

        item.addEventListener('mousemove', handleMouseMove);

        return () => {
            item.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div ref={itemRef} className={`bento-item ${className ?? ''}`}>
            {children}
        </div>
    );
};

// Main Component
export const CyberneticBentoGrid = () => {
    return (
        <>
            <style>{`
                .main-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    padding: 2rem 1rem;
                    position: relative;
                }

                .bento-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                }

                @media (max-width: 768px) {
                    .bento-grid {
                        grid-template-columns: 1fr;
                    }
                    .bento-grid .col-span-2 {
                        grid-column: span 1;
                    }
                }

                .bento-item {
                    position: relative;
                    padding: 1.5rem;
                    border-radius: 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    overflow: hidden;
                    transition: border-color 0.3s ease, box-shadow 0.3s ease;
                }

                .bento-item::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: radial-gradient(
                        600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
                        rgba(99, 102, 241, 0.12),
                        transparent 40%
                    );
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .bento-item:hover::before {
                    opacity: 1;
                }

                .bento-item:hover {
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 0 30px rgba(99, 102, 241, 0.1);
                }
            `}</style>
            <div className="main-container space-y-6">
                <div className="w-full max-w-6xl z-10">
                    <h1 className="text-4xl sm:text-5xl font-bold text-white text-center mb-8">Core Features</h1>
                    <div className="bento-grid">
                        <BentoItem className="col-span-2 row-span-2 flex flex-col justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Real-time Analytics</h2>
                                <p className="mt-2 text-gray-400">Monitor your application's performance with up-to-the-second data streams and visualizations.</p>
                            </div>
                            <div className="mt-4 h-48 bg-neutral-800 rounded-lg flex items-center justify-center text-gray-500">
                                Chart Placeholder
                            </div>
                        </BentoItem>
                        <BentoItem>
                            <h2 className="text-xl font-bold text-white">Global CDN</h2>
                            <p className="mt-2 text-gray-400 text-sm">Deliver content at lightning speed, no matter where your users are.</p>
                        </BentoItem>
                        <BentoItem>
                            <h2 className="text-xl font-bold text-white">Secure Auth</h2>
                            <p className="mt-2 text-gray-400 text-sm">Enterprise-grade authentication and user management built-in.</p>
                        </BentoItem>
                        <BentoItem className="row-span-2">
                            <h2 className="text-xl font-bold text-white">Automated Backups</h2>
                            <p className="mt-2 text-gray-400 text-sm">Your data is always safe with automated, redundant backups.</p>
                        </BentoItem>
                        <BentoItem className="col-span-2">
                            <h2 className="text-xl font-bold text-white">Serverless Functions</h2>
                            <p className="mt-2 text-gray-400 text-sm">Run your backend code without managing servers. Scale infinitely with ease.</p>
                        </BentoItem>
                        <BentoItem>
                            <h2 className="text-xl font-bold text-white">CLI Tool</h2>
                            <p className="mt-2 text-gray-400 text-sm">Manage your entire infrastructure from the command line.</p>
                        </BentoItem>
                    </div>
                </div>
            </div>
        </>
    );
};
