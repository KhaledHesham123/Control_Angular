export interface VesselListDto {
  id: string;
  name: string;
}

export interface VesselUserDto {
  id: string;
  email: string;
  fullName: string | null;
}

export interface VesselDetailsDto {
  id: string;
  name: string;
  imoNumber: string | null;
  flag: string | null;
  notes: string | null;
  isActive: boolean;
  users: VesselUserDto[];
}

export interface UserLookupDto {
  id: string;
  name: string;
  email: string;
  imagePath: string | null;
}

export interface CreateVesselFormValue {
  name: string;
  imoNumber: string;
  flag: string;
  notes: string;
  userIds: string[];
}

export interface UpdateVesselFormValue {
  id: string;
  name: string;
  imoNumber: string;
  flag: string;
  notes: string;
  isActive: boolean;
}
