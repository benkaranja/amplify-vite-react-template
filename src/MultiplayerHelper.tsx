import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react';
import { ReactNode, useState, createContext, useContext, useEffect } from 'react';

interface AuthContextType {
  showAuth: boolean;
  setShowAuth: (show: boolean) => void;
  guestName: string;
  setGuestName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface MultiplayerHelperProps {
  children: ReactNode;
}

export const AuthWrapper = ({ children }: MultiplayerHelperProps) => {
  const [showAuth, setShowAuth] = useState(false);
  const [guestName, setGuestName] = useState('');
  const auth = useAuthenticator();

  useEffect(() => {
    if (auth.authStatus === 'authenticated' && showAuth) {
      setShowAuth(false);
    }
  }, [auth.authStatus, showAuth]);

  return (
    <AuthContext.Provider value={{ showAuth, setShowAuth, guestName, setGuestName }}>
      {showAuth ? (
        <Authenticator>
          {() => <>{children}</>}
        </Authenticator>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const auth = useAuthenticator();
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    throw new Error('useAuth must be used within an AuthWrapper');
  }

  const { setShowAuth, guestName, setGuestName } = authContext;
  
  const email = auth.user?.signInDetails?.loginId;
  const formattedUsername = guestName || (email ? 
    (email.includes('@') ? email.split('@')[0] : email) : 
    'Guest');

  return {
    isAuthenticated: auth.authStatus === 'authenticated' || !!guestName,
    username: formattedUsername,
    signIn: () => setShowAuth(true),
    signOut: () => {
      auth.signOut();
      setGuestName('');
    },
    setGuestName,
    guestName
  };
};
