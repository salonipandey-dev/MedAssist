import { Link } from 'react-router-dom';
import { Logo, Button, PageHeading } from '../../components/ui';
export function Placeholder(){return <main className="container section"><Logo/><PageHeading title="A more connected healthcare experience." description="MedAssist academic product demonstration"/><Button asChild><Link to="/app/patient">Explore patient workspace</Link></Button></main>;}
