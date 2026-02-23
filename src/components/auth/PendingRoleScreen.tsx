"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut, Clock } from "lucide-react";
import Image from "next/image";
import logo from "../../../public/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png";

interface PendingRoleScreenProps {
    user: {
        email: string;
        name?: string;
    };
    onLogout: () => void;
}

export function PendingRoleScreen({ user, onLogout }: PendingRoleScreenProps) {
    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                {/* Logo */}
                <div className="flex justify-center">
                    <div className="w-12 h-12 flex items-center justify-center">
                        <Image
                            src={logo}
                            alt="E8 Logo"
                            className="w-12 h-12 object-contain"
                        />
                    </div>
                </div>

                <Card className="border-yellow-200 bg-yellow-50/30">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                            <Clock className="h-6 w-6 text-yellow-600" />
                        </div>
                        <CardTitle className="text-xl font-bold text-yellow-900">
                            Account Pending Assignment
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                        <p className="text-yellow-800 text-sm">
                            Hi <span className="font-semibold">{user.name || user.email}</span>, your account has been successfully created via Google.
                        </p>
                        <p className="text-gray-600 text-sm">
                            To access the dashboard, an administrator needs to assign you a role (Admin, Editor, Client, etc.).
                        </p>
                        <div className="bg-white/50 p-3 rounded-lg border border-yellow-100 text-xs text-left">
                            <div className="flex items-center gap-2 text-yellow-700 font-medium mb-1">
                                <ShieldAlert className="h-3 w-3" />
                                Next Steps:
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-gray-500">
                                <li>Contact your team administrator</li>
                                <li>Provide them with your email: <span className="font-mono text-[10px]">{user.email}</span></li>
                                <li>Refresh this page once your role is assigned</li>
                            </ul>
                        </div>

                        <Separator className="my-4" />

                        <Button
                            variant="outline"
                            onClick={onLogout}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Separator({ className }: { className?: string }) {
    return <div className={`h-[1px] bg-gray-200 ${className}`} />;
}
