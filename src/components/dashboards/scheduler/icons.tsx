// Platform icons and colors
import { Instagram, Youtube, Facebook, Linkedin, Twitter } from 'lucide-react';

// Custom TikTok Icon Component
export const TikTokIcon = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}
    >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
);

// Custom Snapchat Icon Component
export const SnapchatIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M12.206 1c.266 0 2.869.108 4.156 2.476.68 1.252.515 3.391.39 4.626l-.006.063a.696.696 0 0 0 .282.076c.3-.016.622-.156.933-.312l.085-.043c.259-.126.52-.218.777-.218a.96.96 0 0 1 .388.077c.488.2.564.585.564.775 0 .357-.242.678-.727.964-.134.079-.282.15-.44.224l-.075.035c-.432.197-1.024.467-1.14.862-.063.213-.012.484.149.806l.012.024c.031.065 3.07 6.46-3.148 7.636a.632.632 0 0 0-.094.035c-.053.032-.072.072-.04.15.107.262.345.492.603.736l.059.056c.258.242.536.503.72.82.349.603.162 1.195-.516 1.612-.637.393-1.462.558-2.136.639a4.18 4.18 0 0 0-.403.063c-.135.032-.274.094-.423.16l-.041.018c-.347.155-.828.37-1.537.37-.03 0-.063 0-.094-.002a3.382 3.382 0 0 1-.124.002c-.709 0-1.19-.215-1.537-.37l-.041-.018a2.516 2.516 0 0 0-.423-.16 4.185 4.185 0 0 0-.403-.063c-.674-.081-1.499-.246-2.136-.639-.678-.417-.865-1.009-.516-1.612.184-.317.462-.578.72-.82l.059-.056c.258-.244.496-.474.603-.736.032-.078.013-.118-.04-.15a.632.632 0 0 0-.094-.035C2.93 18.53 5.968 12.135 6 12.07l.012-.024c.161-.322.212-.593.149-.806-.116-.395-.708-.665-1.14-.862l-.075-.035a4.453 4.453 0 0 1-.44-.224C4.02 9.825 3.778 9.504 3.778 9.147c0-.19.076-.575.564-.775a.96.96 0 0 1 .388-.077c.257 0 .518.092.777.218l.085.043c.311.156.634.296.933.312a.696.696 0 0 0 .282-.076l-.006-.063c-.125-1.235-.29-3.374.39-4.626C8.478 1.108 11.08 1 11.794 1h.412z"/>
    </svg>
);

export const PLATFORMS = {
    instagram: { label: 'IG', icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    youtube: { label: 'YT', icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
    tiktok: { label: 'TT', icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
    facebook: { label: 'FB', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    linkedin: { label: 'LI', icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-50' },
    twitter: { label: 'X', icon: Twitter, color: 'text-gray-900', bgColor: 'bg-gray-100' },
    snapchat: { label: 'SC', icon: SnapchatIcon, color: 'text-yellow-500', bgColor: 'bg-yellow-50' },
};