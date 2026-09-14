type LogoProps = {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
  onClick?: () => void;
};

export default function Logo({ size = 'md', animated = false, className = '', onClick }: LogoProps) {
  // Height sizing mapping
  const sizeClasses = {
    xs: 'h-8',
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-24',
    xl: 'h-36 sm:h-44',
  };

  return (
    <div 
      onClick={onClick}
      className={`relative inline-flex items-center select-none ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''} ${className}`}
    >
      <img
        src="/logo.svg"
        alt="Adoración Children Logo"
        className={`w-auto object-contain filter drop-shadow-sm ${sizeClasses[size]} ${
          animated ? 'animate-bounce-subtle' : ''
        }`}
      />
    </div>
  );
}
