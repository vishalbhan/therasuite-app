import { ClientDyteMeetingContainer } from '@/components/video/ClientDyteMeeting';
import { useParams } from 'react-router-dom';

export default function ClientVideoSession() {
  const { appointmentId } = useParams();

  if (!appointmentId) {
    return <div>Invalid appointment</div>;
  }

  return (
    <div className="h-screen">
      <ClientDyteMeetingContainer appointmentId={appointmentId} />
    </div>
  );
}