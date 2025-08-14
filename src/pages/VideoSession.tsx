import { DyteMeetingContainer } from '@/components/video/DyteMeeting';
import { useParams } from 'react-router-dom';

export default function VideoSession() {
  const { appointmentId } = useParams();

  if (!appointmentId) {
    return <div>Invalid appointment</div>;
  }

  return (
    <div className="h-screen">
      <DyteMeetingContainer appointmentId={appointmentId} />
    </div>
  );
} 