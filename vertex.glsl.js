export default `#version 300 es

in vec3 position;
out vec4 vColor;
uniform mat4 modelview;
uniform mat4 projection;
uniform float heightScale;

void main() {
  // apply height scale to Y component
  vec3 scaledPosition = vec3(position.x, position.y * heightScale, position.z);
  
  vec3 positionTransformed = 0.5 * scaledPosition.xyz + vec3(0.5, 0.5, 0.5);
  vColor = vec4(positionTransformed.xyz, 1);
  gl_Position = projection * modelview * vec4(scaledPosition.xyz, 1);
}
`;