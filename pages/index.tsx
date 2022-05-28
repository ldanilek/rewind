import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import React, { useRef, useEffect, useState } from 'react'
import {GameObjectType, GameObject, GameState, navigateInGame, keyCodeToOperation, Operation, maxX, maxY, GameMetadata} from "../common";
import { useQuery, useMutation, useConvex } from "../convex/_generated";
import { Auth0Provider } from "@auth0/auth0-react";
import { useAuth0 } from "@auth0/auth0-react";



import { ConvexProvider, ConvexReactClient } from "convex-dev/react";
import convexConfig from "../convex.json";
import { Canvas } from '../canvas'
import { Id } from 'convex-dev/values'

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
    case GameObjectType.Turnstile:
      color = "orange";
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

const drawGameState = (state: GameState, metadata: GameMetadata, ctx: any) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "gray";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let object of state.objects) {
    drawGameObject(object, ctx);
  }
  ctx.fillStyle = "white";
  if (state.completionMessage) {
    ctx.font = "30px Arial";
    ctx.fillText(state.completionMessage, 130, 50);
  }
  ctx.font = "12px Arial";
  ctx.fillText(`${metadata.rewindsRemaining} rewind${metadata.rewindsRemaining !== 1 ? "s" : ""} remaining`, 10, 440);
};

const RewindCanvas = ({ level }: {level: number}) => {
  const canvasRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState((new Date()).getTime());
  const gameState = useQuery("getGame", currentTime);
  const gameMetadata = useQuery("getGameMetadata");
  const createGame = useMutation("reset");
  const navigate = useMutation("navigate").withOptimisticUpdate(
    (localStore, operation) => {
      console.log(currentTime);
      const currentGameState = localStore.getQuery("getGame", [currentTime])!;
      const currentGameMetadata = localStore.getQuery("getGameMetadata", [])!;
      if (currentGameState && currentGameMetadata) {
        if (currentGameMetadata.rewindsRemaining === 0 && operation === Operation.Rewind) {
          return;
        }
        if (operation === Operation.UseTurnstile) {
          return;
        }
        localStore.setQuery("getGame", [currentTime], navigateInGame(
          currentGameState, 
          currentGameMetadata.timeFlow,
          currentGameState.objects.length-1, 
          operation,
          null, // ok because operation is never Start.
        ));
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
    if (gameState && gameMetadata) {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        drawGameState(gameState, gameMetadata, context);
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
    <Canvas ref={canvasRef} width={maxX * size} height={maxY * size} />
  </div>;
};

const RewindGame = () => {
  const gameMetadata = useQuery("getGameMetadata");
  const [level, setLevel] = useState(1);
  useEffect(() => {
    if (gameMetadata) {
      setLevel(gameMetadata.level);
    }
  }, [gameMetadata]);
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
      <p>WASD to move, T to use Turnstile</p>
    </div>
  );
};

function LoginLogout() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } =
    useAuth0();
  if (isLoading) {
    return <button className="btn btn-primary">Loading...</button>;
  }
  if (isAuthenticated) {
    return (
      <div>
        {/* We know that Auth0 provides the user's name, but another provider
        might not. */}
        <p>Logged in as {user!.name}</p>
        <button
          className="btn btn-primary"
          onClick={() => logout({ returnTo: window.location.origin })}
        >
          Log out
        </button>
      </div>
    );
  } else {
    return (
      <button className="btn btn-primary" onClick={loginWithRedirect}>
        Log in
      </button>
    );
  }
}

const RewindApp = () => {
  const { isAuthenticated, isLoading, getIdTokenClaims } = useAuth0();
  const [userId, setUserId] = useState<Id | null>(null);
  const convex = useConvex();
  const storeUser = useMutation("storeUser");
  // Pass the ID token to the Convex client when logged in, and clear it when logged out.
  // After setting the ID token, call the `storeUser` mutation function to store
  // the current user in the `users` table and return the `Id` value.
  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (isAuthenticated) {
      getIdTokenClaims().then(async claims => {
        // Get the raw ID token from the claims.
        const token = claims!.__raw;
        // Pass it to the Convex client.
        convex.setAuth(token);
        // Store the user in the database.
        // Recall that `storeUser` gets the user information via the `auth`
        // object on the server. You don't need to pass anything manually here.
        const id = await storeUser();
        setUserId(id);
      });
    } else {
      // Tell the Convex client to clear all authentication state.
      convex.clearAuth();
      setUserId(null);
    }
  }, [isAuthenticated, isLoading, getIdTokenClaims, convex, storeUser]);
  
  return <main className={styles.main}>
    <h1 className={styles.title}>
      Play Rewind
    </h1>
    <span><LoginLogout /></span>
    {isAuthenticated ? <RewindGame /> : null}
    
  </main>;

}

const Home: NextPage = () => {
  // Needs to be state to avoid using "window" while server-side rendering.
  const [origin, setOrigin] = useState<string|null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  
  return (
    <div className={styles.container}>
      <Head>
        <title>Rewind</title>
        <meta name="description" content="Game built on Convex" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {origin ?
      <Auth0Provider
        // domain and clientId come from your Auth0 app dashboard
        domain="dev-1rfqpgu8.us.auth0.com"
        clientId="hCuEQRLomvsSRrCXXuk00Rec7cylgYb8"
        redirectUri={origin}
        // allows auth0 to cache the authentication state locally
        cacheLocation="localstorage"
      >
        <ConvexProvider client={convex}>
          <RewindApp />
        </ConvexProvider>
      </Auth0Provider> : <p>Loading...</p>}
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
