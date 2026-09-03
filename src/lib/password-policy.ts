// src/lib/password-policy.ts
//
// Single source of truth for password requirements — imported by both
// the register form (live checklist UI) and the /api/register route
// (the actual enforcement; never trust client-side validation alone).

export const MIN_PASSWORD_LENGTH = 12; // drop to 8 here if you want the more lenient option instead
export const SPECIAL_CHARS = `!@#$%^&*-_=+`;

const SPECIAL_CHARS_REGEX = /[!@#$%^&*\-_=+]/;

export interface PasswordRule {
    id: string;
    label: string;
    test: (password: string, contextStrings: string[]) => boolean;
}

// contextStrings = things the password must NOT contain (email, email
// local-part, first name, last name) — passed in from whatever form/route
// is validating, so this module stays generic.
export const PASSWORD_RULES: PasswordRule[] = [
    {
        id: 'length',
        label: `At least ${MIN_PASSWORD_LENGTH} characters`,
        test: (pw) => pw.length >= MIN_PASSWORD_LENGTH,
    },
    {
        id: 'uppercase',
        label: 'One uppercase letter (A-Z)',
        test: (pw) => /[A-Z]/.test(pw),
    },
    {
        id: 'lowercase',
        label: 'One lowercase letter (a-z)',
        test: (pw) => /[a-z]/.test(pw),
    },
    {
        id: 'number',
        label: 'One number (0-9)',
        test: (pw) => /[0-9]/.test(pw),
    },
    {
        id: 'special',
        label: `One special character (${SPECIAL_CHARS})`,
        test: (pw) => SPECIAL_CHARS_REGEX.test(pw),
    },
    {
        id: 'no-username',
        label: 'Doesn\'t contain your name or email',
        test: (pw, contextStrings) => {
            const lowerPw = pw.toLowerCase();
            return contextStrings
                .filter((s) => s && s.trim().length >= 3)
                .every((s) => !lowerPw.includes(s.trim().toLowerCase()));
        },
    },
];

export interface PasswordValidationResult {
    valid: boolean;
    failedRuleIds: string[];
}

export function validatePassword(password: string, contextStrings: string[] = []): PasswordValidationResult {
    const failedRuleIds = PASSWORD_RULES
        .filter((rule) => !rule.test(password, contextStrings))
        .map((rule) => rule.id);
    return { valid: failedRuleIds.length === 0, failedRuleIds };
}

// Builds the context strings (things the password must not contain) from
// whatever identity fields are available at registration time.
export function buildPasswordContext(opts: { email?: string; firstName?: string; lastName?: string }): string[] {
    const { email, firstName, lastName } = opts;
    const emailLocalPart = email?.split('@')[0] || '';
    return [email || '', emailLocalPart, firstName || '', lastName || ''].filter(Boolean);
}

// HaveIBeenPwned k-anonymity check: only the first 5 hex chars of the
// password's SHA-1 hash are ever sent over the network — the full
// password (and even the full hash) never leaves this function.
// Returns how many times the password has appeared in known breaches
// (0 = not found). Throws on network failure — callers should treat that
// as "couldn't check" rather than "definitely safe", and decide whether
// to soft-fail (allow registration) or hard-fail based on their own risk
// tolerance; this implementation soft-fails (see checkPasswordPwnedSafe).
export async function checkPasswordPwned(password: string): Promise<number> {
    const enc = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', enc);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) {
        throw new Error(`HIBP range lookup failed: ${res.status}`);
    }

    const body = await res.text();
    for (const line of body.split('\n')) {
        const [lineSuffix, countStr] = line.trim().split(':');
        if (lineSuffix === suffix) {
            return parseInt(countStr, 10) || 0;
        }
    }
    return 0;
}

// Soft-fail wrapper — if the HIBP API is unreachable, we don't want to
// block registration entirely over a third-party outage. Returns null
// when the check couldn't be completed, rather than throwing.
export async function checkPasswordPwnedSafe(password: string): Promise<number | null> {
    try {
        return await checkPasswordPwned(password);
    } catch (err) {
        console.error('HIBP pwned-password check failed (allowing registration to proceed):', err);
        return null;
    }
}