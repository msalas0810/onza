import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'Onza Demo',short_name:'Onza',start_url:'/',display:'standalone',background_color:'#FFFFFF',theme_color:'#681D3B',icons:[{src:'/brand/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/brand/icon-512.png',sizes:'512x512',type:'image/png'}]}}
