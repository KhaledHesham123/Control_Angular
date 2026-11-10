export interface LoginCommand {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface TokenDto {
  accessToken: string;
  refreshToken: string;
  expires: string;
}

export interface AuthVesselDto {
  id: string;
  name: string;
}

export interface LoginResponseDto {
  userId: string;
  email: string;
  fullName: string | null;
  token: TokenDto;
  vessel?: AuthVesselDto | null;
}

export interface AuthSession {
  userId: string;
  email: string;
  fullName: string | null;
  accessToken: string;
  refreshToken: string;
  expires: string;
  rememberMe: boolean;
  vessel: AuthVesselDto | null;
}
