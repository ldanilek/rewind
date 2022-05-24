import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import React, { useRef, useEffect, useState } from 'react'
import {GameObjectType, GameObject, GameState, navigateInGame, keyCodeToOperation, Operation, maxX, maxY} from "./common";
import { useQuery, useMutation, useConvex } from "../convex/_generated";

import { ConvexProvider, ConvexReactClient } from "convex-dev/react";
import convexConfig from "../convex.json";

const convex = new ConvexReactClient(convexConfig.origin);


const size = 30;

const drawGameObject = (obj: GameObject, ctx: any) => {
  let color: string;
  switch (obj.objectType) {
    case GameObjectType.Player:
      color = "blue";
      break;
    case GameObjectType.FormerPlayer:
      color = "LightBlue";
      break;
    case GameObjectType.Goal:
      color = "yellow";
      break;
    case GameObjectType.Obstacle:
      color = "black";
      break;
    case GameObjectType.Sensor:
      color = "green";
      break;
    default:
      throw Error("unrecognized object type");
  }
  ctx.fillStyle = color;
  const x = obj.locationX;
  const y = obj.locationY;
  if (x === null || y === null) {
    return;
  }
  ctx.fillRect(x * size, y * size, size, size);
};

const drawGameState = (state: GameState, ctx: any) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "gray";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let object of state.objects) {
    drawGameObject(object, ctx);
  }
  if (state.completionMessage) {
    ctx.font = "30px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(state.completionMessage, 130, 50);
  }
};

const RewindCanvas = ({ level }) => {
  const canvasRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState((new Date()).getTime());
  const gameState = useQuery("getGame", "", level, currentTime);
  const createGame = useMutation("reset");
  const navigate = useMutation("navigate").withOptimisticUpdate(
    (localStore, operation) => {
      console.log(currentTime);
      const currentGameState = localStore.getQuery("getGame", ["", level, currentTime])!;
      if (currentGameState) {
        localStore.setQuery("getGame", ["", level, currentTime], navigateInGame(currentGameState, currentGameState.objects.length-1, operation));
      }
    }
  );

  const pushTime = (time: number | undefined) => {
    let newTime = currentTime;
    if (time && time > newTime) {
      newTime = time;
    }
    const realCurrentTime = (new Date()).getTime();
    if (realCurrentTime > newTime) {
      newTime = realCurrentTime;
    }
    console.log("updated time: ", newTime);
    setCurrentTime(newTime);
  }

  console.log(gameState);
  useEffect(() => {
    if (gameState) {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        drawGameState(gameState, context);
        const nextTime = gameState.nextTime;
        if (nextTime && nextTime !== currentTime) {
          setTimeout(() => {
            pushTime(nextTime);
          }, nextTime - (new Date()).getTime());
        }
      }
    }
  });

  const handleKeyDown = (event: any) => {
    console.log(event);
    const keyCode = event.keyCode;
    console.log(keyCode);
    const operation = keyCodeToOperation(keyCode);
    if (operation) {
      event.preventDefault();
      navigate(operation).then((newTime) => {
        pushTime(newTime);
      });
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });

  useEffect(() => {
    if (gameState === null) {
      createGame(level);
    }
  });

  return <div>
    <canvas ref={canvasRef} width={maxX * size} height={maxY * size} />
  </div>;
};

const RewindGame = () => {
  const [level, setLevel] = useState(1);
  const reset = useMutation("reset");
  const handleReset = () => {
    reset(level);
  };
  const handleLevelChange = (event: any) => {
    setLevel(+event.target.value);
  };
  return (
    <div>
      <RewindCanvas level={level} />
      <div>
        Level: <input type="number" value={level} onChange={handleLevelChange} />
        <button onClick={handleReset}>Reset</button>
      </div>
      <p>WASD to move, R to rewind</p>
    </div>
  );
};

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Play Rewind
        </h1>
        <ConvexProvider client={convex}>
          <RewindGame />
        </ConvexProvider>

        
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  )
}

export default Home
