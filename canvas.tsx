
import React, { useRef, useEffect, useState } from 'react'

type CanvasProps = {
  width: number,
  height: number,
};

export const Canvas = React.forwardRef(({width, height}: CanvasProps, canvasRef: any) => {
  const ratio = (typeof window !== 'undefined') ? window.devicePixelRatio : 1;
  useEffect(() => {
    const c = canvasRef.current;
    if (c !== null) {
      console.log("scale");
      c.width = width * ratio;
      c.height = height * ratio;
      c.getContext("2d").scale(ratio, ratio);
    }
  }, []);
  return <canvas ref={canvasRef} width={width} height={height} style={{width: width+"px", height: height+"px"}} />;
});
