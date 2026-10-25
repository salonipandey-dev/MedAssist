import { Component, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { Provider } from './Provider';
import { AppLayout } from '../components/layout/AppLayout';
import { Placeholder } from '../pages/public/Placeholder';
import { Button, EmptyState, Skeleton } from '../components/ui';
class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<main className="container section"><EmptyState title="The workspace could not load" description="Reload to restore the fictional demo. No records have been sent." action={<Button onClick={()=>window.location.reload()}>Reload demo</Button>}/></main>:this.props.children;}}
function RouteEffects(){const {pathname}=useLocation();useEffect(()=>{document.title=`MedAssist · ${pathname.includes('/app')?'Demo Workspace':'Connected Healthcare'}`;window.scrollTo({top:0});},[pathname]);return null;}
export function App(){return <ErrorBoundary><Provider><BrowserRouter><RouteEffects/><Suspense fallback={<Skeleton/>}><Routes><Route path="/" element={<Placeholder/>}/><Route path="/app/:role" element={<AppLayout/>}><Route path="*" element={<Placeholder/>}/></Route><Route path="*" element={<EmptyState title="This page isn’t here" description="Head back to MedAssist to continue exploring." action={<Button asChild><Link to="/">Back to home</Link></Button>}/>}/></Routes></Suspense></BrowserRouter></Provider></ErrorBoundary>;}
