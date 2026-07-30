import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  teamId: string | null;
  setTeamId: (teamId: string | null) => void;
}

// 도플러식 워크스페이스(팀) 선택 상태 — 사이드바 셀렉터에서 고르면 전체 화면이 이 팀 기준으로 동작
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      teamId: null,
      setTeamId: (teamId) => set({ teamId }),
    }),
    { name: 'workspace-storage' }
  )
);
