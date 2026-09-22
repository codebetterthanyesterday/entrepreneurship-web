import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen Card digunakan sebagai wadah/kontainer untuk mengelompokkan informasi terkait, 
 * seperti daftar produk atau ringkasan pesanan.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, as: Component = "div", interactive, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          "bg-white border-[1.5px] border-line rounded-[18px] p-4",
          interactive && "cursor-pointer transition-colors hover:border-pink",
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Card.displayName = "Card";

export { Card };
