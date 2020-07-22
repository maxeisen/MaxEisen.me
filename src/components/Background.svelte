<div class="background">
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
</div>

<style>
    @keyframes move {
        100% {
            transform: translate3d(0, 0, 1px) rotate(360deg);
        }
    }

    .background {
        position: fixed;
        width: 100vw;
        height: 100vh;
        top: 0;
        left: 0;
        background: #121212;
        overflow: hidden;
    }

    .background span {
        width: 20vmin;
        height: 20vmin;
        border-radius: 20vmin;
        backface-visibility: hidden;
        position: absolute;
        animation: move;
        animation-duration: 30;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
    }

    .background span:nth-child(0) {
        color: rgba(0, 187, 162, 0.25);
        top: 42%;
        left: 20%;
        animation-duration: 168s;
        animation-delay: -22s;
        transform-origin: -16vw 11vh;
        box-shadow: -40vmin 0 5.329900598437797vmin currentColor;
    }
    .background span:nth-child(1) {
        color: rgba(0, 187, 162, 0.25);
        top: 28%;
        left: 18%;
        animation-duration: 143s;
        animation-delay: -156s;
        transform-origin: 2vw -6vh;
        box-shadow: 40vmin 0 5.2098071441108935vmin currentColor;
    }
    .background span:nth-child(2) {
        color: rgba(0, 187, 162, 0.25);
        top: 33%;
        left: 33%;
        animation-duration: 131s;
        animation-delay: -119s;
        transform-origin: 16vw 8vh;
        box-shadow: 40vmin 0 5.871618235646871vmin currentColor;
    }
    .background span:nth-child(3) {
        color: rgba(0, 187, 162, 0.25);
        top: 50%;
        left: 51%;
        animation-duration: 17s;
        animation-delay: -100s;
        transform-origin: 19vw -2vh;
        box-shadow: 40vmin 0 5.046922162999829vmin currentColor;
    }
    .background span:nth-child(4) {
        color: rgba(0, 49, 82, 0.5);
        top: 53%;
        left: 72%;
        animation-duration: 117s;
        animation-delay: -113s;
        transform-origin: 11vw 17vh;
        box-shadow: 40vmin 0 5.612189888735023vmin currentColor;
    }
    .background span:nth-child(5) {
        color: rgba(0, 187, 162, 0.25);
        top: 1%;
        left: 60%;
        animation-duration: 47s;
        animation-delay: -42s;
        transform-origin: 3vw 2vh;
        box-shadow: 40vmin 0 5.206627635224327vmin currentColor;
    }
    .background span:nth-child(6) {
        color: rgba(0, 49, 82, 0.5);
        top: 73%;
        left: 32%;
        animation-duration: 126s;
        animation-delay: -5s;
        transform-origin: -4vw -15vh;
        box-shadow: -40vmin 0 5.6507199928053495vmin currentColor;
    }
    .background span:nth-child(7) {
        color: rgba(0, 187, 162, 0.25);
        top: 81%;
        left: 38%;
        animation-duration: 125s;
        animation-delay: -198s;
        transform-origin: 6vw -19vh;
        box-shadow: -40vmin 0 5.605093850300852vmin currentColor;
    }
    .background span:nth-child(8) {
        color: rgba(0, 49, 82, 0.5);
        top: 60%;
        left: 92%;
        animation-duration: 195s;
        animation-delay: -172s;
        transform-origin: 21vw -24vh;
        box-shadow: -40vmin 0 5.00573097576059vmin currentColor;
    }
    .background span:nth-child(9) {
        color: rgba(0, 187, 162, 0.25);
        top: 49%;
        left: 36%;
        animation-duration: 184s;
        animation-delay: -33s;
        transform-origin: -7vw -2vh;
        box-shadow: -40vmin 0 5.874517674730427vmin currentColor;
    }
    .background span:nth-child(10) {
        color: rgba(0, 187, 162, 0.25);
        top: 80%;
        left: 81%;
        animation-duration: 172s;
        animation-delay: -60s;
        transform-origin: -20vw 20vh;
        box-shadow: 40vmin 0 5.048862454480109vmin currentColor;
    }
    .background span:nth-child(11) {
        color: rgba(0, 49, 82, 0.5);
        top: 69%;
        left: 18%;
        animation-duration: 29s;
        animation-delay: -83s;
        transform-origin: 0vw -18vh;
        box-shadow: -40vmin 0 5.729224670639732vmin currentColor;
    }
    .background span:nth-child(12) {
        color: rgba(0, 49, 82, 0.5);
        top: 23%;
        left: 51%;
        animation-duration: 34s;
        animation-delay: -159s;
        transform-origin: 17vw 25vh;
        box-shadow: -40vmin 0 5.994595029032325vmin currentColor;
    }
    .background span:nth-child(13) {
        color: rgba(0, 49, 82, 0.5);
        top: 55%;
        left: 68%;
        animation-duration: 173s;
        animation-delay: -147s;
        transform-origin: 12vw -4vh;
        box-shadow: 40vmin 0 5.892382289719992vmin currentColor;
    }
    .background span:nth-child(14) {
        color: rgba(0, 187, 162, 0.25);
        top: 54%;
        left: 61%;
        animation-duration: 128s;
        animation-delay: -148s;
        transform-origin: -23vw 23vh;
        box-shadow: -40vmin 0 5.274061289731119vmin currentColor;
    }
    .background span:nth-child(15) {
        color: rgba(0, 49, 82, 0.5);
        top: 83%;
        left: 85%;
        animation-duration: 184s;
        animation-delay: -111s;
        transform-origin: -18vw -1vh;
        box-shadow: -40vmin 0 5.2549632898322205vmin currentColor;
    }
    .background span:nth-child(16) {
        color: rgba(0, 187, 162, 0.25);
        top: 62%;
        left: 48%;
        animation-duration: 41s;
        animation-delay: -21s;
        transform-origin: 16vw -10vh;
        box-shadow: -40vmin 0 5.716845656780269vmin currentColor;
    }
    .background span:nth-child(17) {
        color: rgba(0, 49, 82, 0.5);
        top: 14%;
        left: 6%;
        animation-duration: 25s;
        animation-delay: -145s;
        transform-origin: -13vw -19vh;
        box-shadow: -40vmin 0 5.750171170060737vmin currentColor;
    }
    .background span:nth-child(18) {
        color: rgba(0, 187, 162, 0.25);
        top: 75%;
        left: 14%;
        animation-duration: 96s;
        animation-delay: -60s;
        transform-origin: 0vw 10vh;
        box-shadow: -40vmin 0 5.8066305070537565vmin currentColor;
    }
    .background span:nth-child(19) {
        color: rgba(0, 187, 162, 0.25);
        top: 7%;
        left: 37%;
        animation-duration: 51s;
        animation-delay: -40s;
        transform-origin: 25vw 16vh;
        box-shadow: 40vmin 0 5.817567098501535vmin currentColor;
    }
</style>