import { Component, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { Provider } from './Provider';
import { AppLayout } from '../components/layout/AppLayout';
import { Placeholder } from '../pages/public/Placeholder';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Home, PlatformPage, HowItWorks, SecurityPage, AboutPage } from '../pages/public/Pages';
import { DemoAccess } from '../features/auth/DemoAccess';
import { Button, EmptyState, Skeleton } from '../components/ui';
class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<main className="container section"><EmptyState title="The workspace could not load" description="Reload to restore the fictional demo. No records have been sent." action={<Button onClick={()=>window.location.reload()}>Reload demo</Button>}/></main>:this.props.children;}}
function RouteEffects(){const {pathname}=useLocation();useEffect(()=>{document.title=`MedAssist · ${pathname.includes('/app')?'Demo Workspace':'Connected Healthcare'}`;window.scrollTo({top:0});},[pathname]);return null;}
export function App(){return <ErrorBoundary><Provider><BrowserRouter><RouteEffects/><Suspense fallback={<Skeleton/>}><Routes><Route element={<PublicLayout/>}><Route index element={<Home/>}/><Route path="platform" element={<PlatformPage/>}/><Route path="how-it-works" element={<HowItWorks/>}/><Route path="patients" element={<PlatformPage kind="patients"/>}/><Route path="professionals" element={<PlatformPage kind="professionals"/>}/><Route path="security" element={<SecurityPage/>}/><Route path="about" element={<AboutPage/>}/><Route path="demo" element={<DemoAccess/>}/></Route><Route path="/app/:role" element={<AppLayout/>}><Route path="*" element={<Placeholder/>}/></Route><Route path="*" element={<EmptyState title="This page isn’t here" description="Head back to MedAssist to continue exploring." action={<Button asChild><Link to="/">Back to home</Link></Button>}/>}/></Routes></Suspense></BrowserRouter></Provider></ErrorBoundary>;}
