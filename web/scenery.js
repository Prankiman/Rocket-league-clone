import {addOriginalSet} from './original-scene.js';

// The night-city skybox replaces the park's trees, mountains, background city
// blocks and atmosphere. Keep only structures that belong to the stadium.
const STADIUM_STRUCTURE = /^(?:Park_|Field_Lights$|ConcreteBase$)/;

export async function addScenery(scene, camera) {
  camera.far = 1200;
  camera.updateProjectionMatrix();
  return addOriginalSet(scene, 'scenery', name => STADIUM_STRUCTURE.test(name));
}
