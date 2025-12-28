export interface Topic {
  id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  topic_id: string;
  image_url?: string;
  created_at: string;
}

export interface Doll {
  id: string;
  name: string;
  description: string | null;
  size: string; // Changed to string to allow "Normal, Small" etc.
  category_id: string | null;
  topic_id: string;
  catch_date: string | null;
  image_url: string;
  created_at: string;
}

export enum ViewState {
  HOME = 'HOME',
  CATEGORY = 'CATEGORY',
  PROFILE = 'PROFILE'
}

export interface NewDollForm {
  name: string;
  description: string;
  size: string[]; // Changed to array for checkboxes
  category_id: string;
  catch_date: string;
  imageFile: File | null;
}

export type SortOption = 'DATE_DESC' | 'DATE_ASC' | 'NAME_ASC' | 'NAME_DESC';
export type GridOption = 'GRID_2' | 'GRID_3' | 'GRID_4' | 'LIST';
