import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src/config/portfolio.json');

export async function GET() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        return NextResponse.json({ ok: true, sections: JSON.parse(data) });
    } catch (err) {
        return NextResponse.json({ ok: false, message: 'Failed to read config' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { sections } = body;

        if (!Array.isArray(sections)) {
            return NextResponse.json({ ok: false, message: 'Invalid data format' }, { status: 400 });
        }

        await fs.writeFile(CONFIG_PATH, JSON.stringify(sections, null, 4), 'utf8');
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ ok: false, message: 'Failed to update config' }, { status: 500 });
    }
}
