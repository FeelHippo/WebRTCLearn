import { createStore } from 'vuex'
import windowOnload from '../utils/web_rtc'

export interface State {
    firstOperand: string;
    secondOperand: string;
    operator: string;
    peerConnection: RTCPeerConnection | null;
    dataChannel: any;
}

export default createStore({
    state: () => ({
        // presentation
        firstOperand: '',
        secondOperand: '',
        operator: '',
        // peer connection
        peerConnection: null,
        dataChannel: null,
    }) as State,
    getters: {
        output: state => `${state.firstOperand} ${state.operator} ${state.secondOperand}`,
    },
    mutations: {
        updateState(state, data) {
            state[data.name as keyof State] = data.value;
        },
    },
    actions: {
        async peerConnection({ commit, state }) {
            windowOnload(commit, state);
        },
    }
}) 