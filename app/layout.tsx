import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'موائمة | من أفكار متعددة إلى مخرج واحد',description:'مساحتك للعمل المشترك. ساهم بفكرتك، ووائمها مع فريقك، وابنِ مخرجًا يجمع أفضل ما لديكم.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
