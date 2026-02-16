"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Separator } from '../ui/separator';
import { CheckCircle, Video, Palette, FileText, AlertTriangle, Target, BookOpen, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';

interface Guideline {
    id: string;
    category: string;
    title: string;
    content: string;
    role: string | null;
    clientId: string | null;
    client?: {
        name: string;
        companyName: string;
    };
}

interface DynamicGuidelinesPageProps {
    role: "qc" | "editor";
    title: string;
    description: string;
}

export function DynamicGuidelinesPage({ role, title, description }: DynamicGuidelinesPageProps) {
    const [guidelines, setGuidelines] = useState<Guideline[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchGuidelines() {
            try {
                setLoading(true);
                const res = await fetch(`/api/guidelines?role=${role}`);
                const data = await res.json();
                if (data.ok) {
                    setGuidelines(data.guidelines);
                }
            } catch (error) {
                console.error("Failed to fetch guidelines", error);
            } finally {
                setLoading(false);
            }
        }
        fetchGuidelines();
    }, [role]);

    // Group by category
    const categories = Array.from(new Set(guidelines.map(g => g.category)));

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    <p className="text-muted-foreground mt-2">
                        {description}
                    </p>
                </div>
                <BookOpen className="h-10 w-10 text-primary opacity-20" />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p>Loading guidelines...</p>
                </div>
            ) : guidelines.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {categories.map((category) => (
                        <Card key={category}>
                            <CardHeader className="border-b bg-muted/30">
                                <CardTitle className="text-xl">{category}</CardTitle>
                                <CardDescription>
                                    Standards and rules categorized under {category}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-8">
                                {guidelines
                                    .filter(g => g.category === category)
                                    .map((g, idx, arr) => (
                                        <div key={g.id} className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-primary/10 rounded-lg mt-1">
                                                    <CheckCircle className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-lg">{g.title}</h3>
                                                        {g.clientId && (
                                                            <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                                                                {g.client?.companyName || g.client?.name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                                        {g.content}
                                                    </div>
                                                </div>
                                            </div>
                                            {idx < arr.length - 1 && <Separator className="ml-14" />}
                                        </div>
                                    ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-dashed border-2 py-20">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                        <h3 className="text-lg font-medium">No guidelines found</h3>
                        <p className="text-muted-foreground max-w-sm mt-1">
                            There are currently no specific guidelines assigned to the {role === 'qc' ? 'QC' : 'Editor'} role.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
