import { initials } from '../../utils/format';
import { resolveAssetUrl } from '../../services/runtime';
export function Avatar({ src, name, className = '' }: { src?: string | null; name?: string | null; className?: string }) { const image = resolveAssetUrl(src); return image ? <img src={image} alt={name || ''} className={`h-9 w-9 rounded-xl object-cover ${className}`} /> : <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-xs font-bold text-brand-700 ${className}`}>{initials(name)}</span>; }
