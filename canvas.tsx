
import React, { useRef, useEffect, useState } from 'react'

type CanvasProps = {
  width: number,
  height: number,
  children?: React.ReactNode,
};

const CanvasComponent = ({width, height, children}: CanvasProps, canvasRef: any) => {
  const ratio = (typeof window !== 'undefined') ? window.devicePixelRatio : 1;
  useEffect(() => {
    const c = canvasRef.current;
    if (c !== null) {
      console.log("scale");
      c.width = width * ratio;
      c.height = height * ratio;
      c.getContext("2d").scale(ratio, ratio);
    }
  }, [canvasRef, height, ratio, width]);
  return (
    <div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{width: width+"px", height: height+"px"}}
      />
      {children}
    </div>
  );
};

CanvasComponent.displayName = "canvas";

export const Canvas = React.forwardRef(CanvasComponent);
