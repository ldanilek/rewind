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

const drawGameObject = (
  obj: GameObject,
  ctx: CanvasRenderingContext2D,
  images: Map<string, CanvasImageSource>,
) => {
  let color: string;
  switch (obj.objectType) {
    case GameObjectType.Player:
    case GameObjectType.FormerPlayer:
      // Unused because svg has color.
      color = "black";
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
  let path: string | null = null;
  let drawSize = 24;
  let image: string | null = null;
  switch (obj.objectType) {
    case GameObjectType.Turnstile:
      // svgrepo ic_fluent_history_24_filled
      path = "M12,3 C16.9705627,3 21,7.02943725 21,12 C21,16.9705627 16.9705627,21 12,21 C10.2906397,21 8.64934582,20.5216903 7.23062266,19.6336282 C6.652798,19.2719338 6.11762369,18.845602 5.63566519,18.3635872 C5.15297254,17.8808382 4.72614095,17.3447197 4.36416292,16.7658467 C3.47750386,15.3479072 3,13.7079229 3,12 C3,11.7259752 3.01227563,11.4533053 3.03668633,11.1825607 C3.08627989,10.6325071 3.57238994,10.2268041 4.1224435,10.2763977 C4.67249706,10.3259912 5.07820005,10.8121013 5.02860649,11.3621549 C5.00957779,11.5732065 5,11.7859512 5,12 C5,13.3301778 5.37065893,14.6032038 6.05991929,15.7054646 C6.34163835,16.1559879 6.6740111,16.5734621 7.04996135,16.9494563 C7.42534016,17.3248789 7.84207996,17.6568631 8.29178905,17.9383625 C9.39466252,18.6287158 10.6687045,19 12,19 C15.8659932,19 19,15.8659932 19,12 C19,8.13400675 15.8659932,5 12,5 C10.1286447,5 8.38425005,5.73939998 7.09794405,7.00203852 L8.4977105,7.00341461 C9.04999525,7.00341461 9.4977105,7.45112986 9.4977105,8.00341461 C9.4977105,8.51625045 9.11167031,8.93892177 8.61433163,8.99668688 L8.4977105,9.00341461 L4.4963095,9.00341461 C3.98347366,9.00341461 3.56080234,8.61737442 3.50303724,8.12003574 L3.4963095,8.00341461 L3.4963095,4.00351123 C3.4963095,3.45122648 3.94402475,3.00351123 4.4963095,3.00351123 C5.00914534,3.00351123 5.43181666,3.38955142 5.48958177,3.88689011 L5.4963095,4.00351123 L5.49588685,5.77845613 C7.16609908,4.03157881 9.49557109,3 12,3 Z M11.25,7 C11.6295,7 11.9434583,7.28233333 11.9931493,7.64827431 L12,7.75 L12,12 L14.25,12 C14.664,12 15,12.336 15,12.75 C15,13.1295 14.7176667,13.4434583 14.3517257,13.4931493 L14.25,13.5 L11.25,13.5 C10.8705,13.5 10.5565417,13.2176667 10.5068507,12.8517257 L10.5,12.75 L10.5,7.75 C10.5,7.336 10.836,7 11.25,7 Z";
      break;

    case GameObjectType.Player:
      image = "bot";
      break;

    case GameObjectType.FormerPlayer:
      image = "former_bot";
      break;
  
    case GameObjectType.Goal:
      image = "bullseye";
      break;

    case GameObjectType.Sensor:
      path = "M7 17a5.007 5.007 0 0 0 4.898-4H14v2h2v-2h2v3h2v-3h1v-2h-9.102A5.007 5.007 0 0 0 7 7c-2.757 0-5 2.243-5 5s2.243 5 5 5zm0-8c1.654 0 3 1.346 3 3s-1.346 3-3 3-3-1.346-3-3 1.346-3 3-3z";
      break;

    default:
      break;
  }
  ctx.translate(x * size, y * size);
  ctx.scale(size / drawSize, size / drawSize);
  if (path) {
    let p = new Path2D(path);
    ctx.fill(p);
  } else if (image) {
    const element = images.get(image);
    if (!element) {
      throw Error("can't find image " + image);
    }
    ctx.drawImage(element, 0, 0);
  } else {
    ctx.fillRect(0, 0, drawSize, drawSize);
  }
  ctx.scale(drawSize / size, drawSize / size);
  ctx.translate(-x * size, -y * size);
};

const drawGameState = (
  state: GameState, 
  metadata: GameMetadata, 
  ctx: CanvasRenderingContext2D,
  images: Map<string, CanvasImageSource>,
) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "lightgray";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let object of state.objects) {
    drawGameObject(object, ctx, images);
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
  const botImageRef = useRef<any>(null);
  const formerBotImageRef = useRef<any>(null);
  const bullseyeImageRef = useRef<any>(null);
  const gameState = useQuery("getGame");
  const gameMetadata = useQuery("getGameMetadata");
  const createGame = useMutation("reset");
  const bumpGame = useMutation("bumpGameState");
  const navigate = useMutation("navigate").withOptimisticUpdate(
    (localStore, operation) => {
      // Note these are two ways to compute the most recently rendered game state.
      // The former works better because the latter has a tendency to be `undefined` if you do multiple
      // updates in quick succession.
      const currentGameState = localStore.getQuery("getGame", [])!;
      const currentGameMetadata = localStore.getQuery("getGameMetadata", [])!;
      if (currentGameState && currentGameMetadata) {
        if (currentGameMetadata.rewindsRemaining === 0 && operation === Operation.UseTurnstile) {
          return;
        }
        if (operation === Operation.UseTurnstile) {
          return;
        }
        localStore.setQuery("getGame", [], navigateInGame(
          currentGameState, 
          currentGameState.objects.length-1, 
          operation,
          null, // ok because operation is never Start or End.
        ));
      }
    }
  );

  //console.log(gameState);
  useEffect(() => {
    if (gameState && gameMetadata) {
      const canvas = canvasRef.current;
      const botImage = botImageRef.current;
      const formerBotImage = formerBotImageRef.current;
      const bullseyeImage = bullseyeImageRef.current;
      if (canvas && botImage && formerBotImage && bullseyeImage) {
        const context = canvas.getContext('2d');
        drawGameState(
          gameState,
          gameMetadata,
          context,
          new Map([
            ["bot", botImage],
            ["former_bot", formerBotImage],
            ["bullseye", bullseyeImage],
          ]),
        );
        const currentTime = (new Date()).getTime();
        const nextTime = gameState.nextTime;
        if (nextTime) {
          setTimeout(bumpGame, nextTime - currentTime);
        }
      }
    }
  });

  const handleKeyDown = (event: any) => {
    //console.log(event);
    const keyCode = event.keyCode;
    //console.log(keyCode);
    const operation = keyCodeToOperation(keyCode);
    if (operation) {
      event.preventDefault();
      navigate(operation);
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
    <Canvas ref={canvasRef} width={maxX * size} height={maxY * size}>
      <img ref={botImageRef} src="/bot-svgrepo-com.svg" style={{display: "none"}} />
      <img ref={formerBotImageRef} src="/red-bot-svgrepo-com.svg" style={{display: "none"}} />
      <img ref={bullseyeImageRef} src="/bullseye-svgrepo-com.svg" style={{display: "none"}} />
    </Canvas>
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
    {userId !== null ? <RewindGame /> : null}
    
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
