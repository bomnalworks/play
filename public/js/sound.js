// 게임 효과음 — 소리 파일 없이 그때그때 만든다 (너구리·스도쿠가 같이 쓴다)
//
// 가락은 [주파수(Hz), 길이(초), 시작 시각(ms)] 의 목록으로 적는다.
// 켜고 끈 상태는 이 브라우저에만 남는다.
import { store } from './browser.js'

export function createSound(storeKey, tunes) {
  let audio = null
  let on = store.read(storeKey, true) !== false

  function tone(freq, dur, type = 'square', vol = 0.06) {
    if (!on) return
    try {
      audio ??= new (window.AudioContext ?? window.webkitAudioContext)()
      if (audio.state === 'suspended') audio.resume()
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, audio.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur)
      osc.connect(gain).connect(audio.destination)
      osc.start()
      osc.stop(audio.currentTime + dur)
    } catch {
      /* 소리는 못 나도 놀이는 그대로 된다 */
    }
  }

  return {
    get on() {
      return on
    },
    toggle() {
      on = !on
      store.write(storeKey, on)
      if (on) tone(880, 0.08)
      return on
    },
    play(name) {
      for (const [freq, dur, at] of tunes[name] ?? []) setTimeout(() => tone(freq, dur), at)
    },
  }
}

// 켜짐/꺼짐 버튼 하나를 이 소리에 붙인다. 글자와 aria 규약을 여기서만 정한다.
export function bindSoundButton(button, sound) {
  const show = () => {
    button.textContent = sound.on ? '소리 켜짐' : '소리 꺼짐'
    button.setAttribute('aria-pressed', String(sound.on))
  }
  button.addEventListener('click', () => {
    sound.toggle()
    show()
  })
  show()
}
