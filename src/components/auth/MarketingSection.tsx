import { 
  Users, 
  Calendar, 
  Video, 
  CreditCard, 
  LineChart, 
  ShieldCheck 
} from "lucide-react";

const features = [
  {
    title: "Client Management",
    description: "Easily manage your client information, history, and progress in one place",
    icon: Users,
  },
  {
    title: "Smart Scheduling",
    description: "Streamline your appointment booking with an intelligent scheduling system",
    icon: Calendar,
  },
  {
    title: "Video Sessions",
    description: "Conduct secure video therapy sessions directly through the platform",
    icon: Video,
  },
  {
    title: "Payment Processing",
    description: "Handle payments and invoicing seamlessly with integrated payment solutions",
    icon: CreditCard,
  },
  {
    title: "Progress Tracking",
    description: "Monitor client progress and treatment outcomes with detailed analytics",
    icon: LineChart,
  },
  {
    title: "HIPAA Compliant",
    description: "Ensure client data security with our HIPAA-compliant platform",
    icon: ShieldCheck,
  },
];

export function MarketingSection() {
  return (
    <div className="h-full min-h-screen flex flex-col justify-center p-4 sm:p-8 bg-gradient-to-b from-violet-50 to-violet-100">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-violet-900 mb-2 sm:mb-3">
          Transform Your Therapy Practice
        </h1>
        <p className="text-sm sm:text-base text-violet-700 mb-6 sm:mb-10">
          TheraSuite provides everything you need to manage and grow your therapy practice efficiently.
        </p>

        <div className="grid gap-4 sm:gap-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex items-start gap-3">
                <div className="bg-violet-200 rounded-lg p-1.5 sm:p-2 shrink-0">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-violet-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm text-violet-900 mb-0.5">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-violet-700">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 