import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Network, DataSet } from 'vis-network/standalone';

const GraphContainer = styled.div`
  height: 500px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
`;
const NodeInfo = styled.div`
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  background-color: #f9f9f9;
`;

const TimeButton = styled.button`
  background-color: #0078d7;
  color: white;
  border: none;
  padding: 5px 10px;
  margin: 2px;
  border-radius: 3px;
  cursor: pointer;
  &:hover {
    background-color: #005a9e;
  }
`;

const GraphView = ({ graphData, onTimeClick }) => {
  const graphRef = useRef(null);
  const networkRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (graphRef.current && graphData) {
      const nodes = new DataSet(graphData.nodes.map(node => ({
        ...node,
        label: node.id,
        color: getNodeColor(node.type),
      })));
      
      const edges = new DataSet(graphData.relationships.map(rel => ({
        from: rel.source,
        to: rel.target,
        label: rel.type,
        arrows: 'to',
      })));

      const data = { nodes, edges };
      
      const options = {
        nodes: {
          shape: 'dot',
          size: 16,
          font: {
            size: 12,
            face: 'Tahoma',
          },
        },
        edges: {
          width: 0.15,
          color: { inherit: 'both' },
          smooth: {
            type: 'continuous',
          },
        },
        physics: {
          stabilization: false,
          barnesHut: {
            gravitationalConstant: -80000,
            springConstant: 0.001,
          },
        },
        interaction: {
          tooltipDelay: 200,
          hideEdgesOnDrag: true,
        },
      };

      networkRef.current = new Network(graphRef.current, data, options);

      networkRef.current.on('selectNode', (params) => {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);
        setSelectedNode(node);
      });

      networkRef.current.on('deselectNode', () => {
        setSelectedNode(null);
      });
    }
  }, [graphData]);

  const getNodeColor = (type) => {
    const colors = {
      Person: '#4CAF50',
      Location: '#2196F3',
      Event: '#FFC107',
      Evidence: '#9C27B0',
      Statement: '#FF5722',
    };
    return colors[type] || '#607D8B';
  };

  const handleTimeClick = (offset) => {
    if (onTimeClick) {
      const [filename, timestamp] = offset.split('__');
      const [_, minutes, seconds] = timestamp.match(/min(\d+)_(\d+)/);
      const timeInSeconds = parseInt(minutes) * 60 + parseInt(seconds);
      onTimeClick(filename, timeInSeconds);
    }
  };

  return (
    <div>
      <GraphContainer ref={graphRef} />
      {selectedNode && (
        <NodeInfo>
          <h3>{selectedNode.id}</h3>
          <p>Type: {selectedNode.type}</p>
          {selectedNode.properties && (
            <ul>
              {Object.entries(selectedNode.properties).map(([key, value]) => (
                <li key={key}>{key}: {value}</li>
              ))}
            </ul>
          )}
          {graphData.timecodes && graphData.timecodes[selectedNode.id] && (
            <div>
              <p>Mentioned at:</p>
              {graphData.timecodes[selectedNode.id].map((offset, index) => {
                const [filename, timestamp] = offset.split('__');
                const [_, minutes, seconds] = timestamp.match(/min(\d+)_(\d+)/);
                const formattedTime = `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
                return (
                  <TimeButton key={index} onClick={() => handleTimeClick(offset)}>
                    {filename} - {formattedTime}
                  </TimeButton>
                );
              })}
            </div>
          )}
        </NodeInfo>
      )}
    </div>
  );
};

export default GraphView;